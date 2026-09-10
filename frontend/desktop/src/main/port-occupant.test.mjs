import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createPortOccupant } from "./port-occupant.js";

function stubRunCommand(handlers) {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (!Object.hasOwn(handlers, key)) {
      throw new Error(`unexpected command: ${key}`);
    }
    const result = handlers[key];
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };
}

test("windows: identifies listening occupant with image name", async () => {
  const occupant = createPortOccupant({
    platform: "win32",
    runCommand: stubRunCommand({
      "netstat -ano -p TCP":
        "  TCP    127.0.0.1:41000        0.0.0.0:0              LISTENING       1234\r\n",
      "tasklist /FI PID eq 1234 /FO CSV /NH": '"rust_api.exe","1234","Console","1","10,000 K"\r\n',
    }),
  });
  assert.deepEqual(await occupant.getPortOccupant("127.0.0.1", 41000), {
    pid: "1234",
    image: "rust_api.exe",
  });
});

test("windows: free port resolves to null", async () => {
  const occupant = createPortOccupant({
    platform: "win32",
    runCommand: stubRunCommand({
      "netstat -ano -p TCP": "  TCP    127.0.0.1:42000        0.0.0.0:0              LISTENING       999\r\n",
    }),
  });
  assert.equal(await occupant.getPortOccupant("127.0.0.1", 41000), null);
});

test("reclaims own residual backend and re-probes free", async () => {
  let killed = "";
  const occupant = createPortOccupant({
    platform: "win32",
    canConnectToPort: async () => false,
    runCommand: async (command, args) => {
      if (command === "netstat") {
        return "  TCP    127.0.0.1:41002        0.0.0.0:0              LISTENING       77\r\n";
      }
      if (command === "tasklist") {
        return '"retain-jobsd.exe","77","Console","1","5,000 K"\r\n';
      }
      if (command === "taskkill") {
        killed = args.join(" ");
        return "";
      }
      throw new Error(`unexpected command: ${command}`);
    },
  });
  const result = await occupant.reclaimPortIfOwnResidual("127.0.0.1", 41002);
  assert.equal(result.status, "reclaimed");
  assert.equal(result.occupant.image, "retain-jobsd.exe");
  assert.match(killed, /\/T.*\/F/);
});

test("foreign occupant is never killed", async () => {
  let taskkillCalled = false;
  const occupant = createPortOccupant({
    platform: "win32",
    runCommand: async (command) => {
      if (command === "netstat") {
        return "  TCP    127.0.0.1:41000        0.0.0.0:0              LISTENING       555\r\n";
      }
      if (command === "tasklist") {
        return '"docker.exe","555","Console","1","5,000 K"\r\n';
      }
      if (command === "taskkill") {
        taskkillCalled = true;
        return "";
      }
      throw new Error(`unexpected command: ${command}`);
    },
  });
  const result = await occupant.reclaimPortIfOwnResidual("127.0.0.1", 41000);
  assert.equal(result.status, "busy");
  assert.equal(taskkillCalled, false);
  assert.match(occupant.describeOccupant(41000, result.occupant), /docker\.exe.*555/);
});

test("python.exe is not treated as own backend", async () => {
  const occupant = createPortOccupant({ platform: "win32" });
  assert.equal(occupant.isOwnResidualBackend("python.exe"), false);
  assert.equal(occupant.isOwnResidualBackend("retain-jobsd.exe"), true);
  assert.equal(occupant.isOwnResidualBackend("RUST_API.EXE"), true);
});

test("lookup failure degrades to busy with null occupant", async () => {
  const occupant = createPortOccupant({
    platform: "win32",
    runCommand: async () => {
      throw new Error("netstat not found");
    },
  });
  const result = await occupant.reclaimPortIfOwnResidual("127.0.0.1", 41000);
  assert.equal(result.status, "busy");
  assert.equal(result.occupant, null);
  assert.equal(occupant.describeOccupant(41000, null), "");
});

test("windows: localized tasklist info line yields unknown image, then API identifies backend", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: { status: "up" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let killed = "";
  const occupant = createPortOccupant({
    platform: "win32",
    canConnectToPort: async () => false,
    runCommand: async (command) => {
      if (command === "netstat") {
        return `  TCP    127.0.0.1:${port}        0.0.0.0:0              LISTENING       27392\r\n`;
      }
      if (command === "tasklist") {
        return "信息: 没有运行与指定标准匹配的任务。\r\n";
      }
      if (command === "taskkill") {
        killed = "yes";
        return "";
      }
      throw new Error(`unexpected command: ${command}`);
    },
  });
  try {
    const result = await occupant.reclaimPortIfOwnResidual("127.0.0.1", port);
    assert.equal(result.status, "reclaimed");
    assert.equal(killed, "yes");
    assert.match(occupant.describeOccupant(port, result.occupant), /RetainPDF 后端残留.*27392/);
    assert.match(occupant.describeOccupant(port, result.occupant), /taskkill \/PID 27392 \/F/);
  } finally {
    server.close();
  }
});

test("windows: unknown image with no backend signature stays busy with kill hint", async () => {
  const occupant = createPortOccupant({
    platform: "win32",
    runCommand: async (command) => {
      if (command === "netstat") {
        return "  TCP    127.0.0.1:41000        0.0.0.0:0              LISTENING       555\r\n";
      }
      if (command === "tasklist") {
        throw new Error("access denied");
      }
      throw new Error(`unexpected command: ${command}`);
    },
  });
  const result = await occupant.reclaimPortIfOwnResidual("127.0.0.1", 41000);
  assert.equal(result.status, "busy");
  assert.match(occupant.describeOccupant(41000, result.occupant), /taskkill \/PID 555 \/F/);
});

test("killProcessTreeSync terminates the tree synchronously", () => {
  const calls = [];
  const occupant = createPortOccupant({
    platform: "win32",
    runCommandSync: (command, args) => {
      calls.push([command, args]);
      return "";
    },
  });
  assert.equal(occupant.killProcessTreeSync(1234), true);
  assert.deepEqual(calls, [["taskkill", ["/PID", "1234", "/T", "/F"]]]);
});

test("killProcessTreeSync failure returns false", () => {
  const occupant = createPortOccupant({
    platform: "win32",
    runCommandSync: () => {
      throw new Error("denied");
    },
  });
  assert.equal(occupant.killProcessTreeSync(1234), false);
});
