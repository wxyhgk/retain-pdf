// 测试用：进程退出时把遥测相关的环境变量写到 stderr（node --import 预加载），核对命令行入口确实关了遥测。
process.on("exit", () => {
  const pick = (name) => (name in process.env ? process.env[name] : null);
  process.stderr.write(`ENV-PROBE ${JSON.stringify({
    OPENUI_TELEMETRY_DISABLED: pick("OPENUI_TELEMETRY_DISABLED"),
    DO_NOT_TRACK: pick("DO_NOT_TRACK"),
    OPENUI_RUNTIME_TELEMETRY_ENABLED: pick("OPENUI_RUNTIME_TELEMETRY_ENABLED"),
  })}\n`);
});
