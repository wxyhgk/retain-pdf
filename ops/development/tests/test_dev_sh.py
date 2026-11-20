"""`dev.sh` 的结构不变量。

这是个 shell 脚本，没法像模块那样单测；但它错了的后果很重（整个本地栈起不来，
而且报错往往指向别处）。所以守几条**读文本就能查**的：

- 不能把 API key 写进脚本（它会被提交）
- 必须 nohup（不 nohup 的话进程跟着会话走，这正是要解决的问题）
- 起之前必须先停（端口占用导致的失败最难查）
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "dev.sh"


@pytest.fixture(scope="module")
def source() -> str:
    assert SCRIPT.is_file(), f"找不到 {SCRIPT}"
    return SCRIPT.read_text(encoding="utf-8")


def test_the_api_key_is_read_at_runtime_not_baked_in(source: str) -> None:
    """key 必须从 gitignored 的 runtime-config.local.js 里读。

    写死在脚本里就等于提交了凭据 —— 这个脚本是进仓库的。
    """
    assert "runtime-config.local.js" in source
    assert "grep -oE 'xApiKey" in source
    # 任何看起来像真 key 的东西都不该出现。
    import re

    assert not re.search(r"sk-[A-Za-z0-9]{16}", source), "脚本里有疑似真实 key"


def test_processes_are_detached(source: str) -> None:
    """不 nohup 的话进程跟着终端会话走 —— 那正是这个脚本要解决的问题。

    实测过：会话结束后本地栈四次全没，每次重来等一分钟 cargo。
    """
    assert source.count("nohup ") >= 2, "两个进程都要 nohup"
    assert "disown" in source


def test_background_jobs_get_their_own_process_group(source: str) -> None:
    """`nohup` 只挡 SIGHUP，挡不住给整个进程组发的 SIGTERM。

    实测：只有 nohup + disown 时，调用方收尾会把后台栈一起带走 ——
    日志里是 "received signal 15"，而表面现象是「刚说起来了，下一秒就没了」。
    `set -m` 让后台任务进自己的进程组。
    """
    assert "set -m" in source, "没开 job control，后台进程会跟着调用方一起死"


def test_up_stops_first(source: str) -> None:
    """端口被占着起不来，而「起不来」的报错常常指向别处。

    有过一次：另一个 checkout 的 jobsd 残留在 41002，表现是 502/503 风暴。
    """
    up = source[source.index("cmd_up()") : source.index("cmd_status()")]
    assert "cmd_down" in up, "up 没有先停"


def test_it_binds_all_interfaces(source: str) -> None:
    """产品决定：开发服务绑 0.0.0.0，不改成 127.0.0.1。

    静态服务写死在 cmd_up 里；后端的地址由 `api_host` 定，见下面几条真跑 bash 的。
    """
    up = source[source.index("cmd_up() {") : source.index("cmd_status() {")]
    assert up.count("--host 0.0.0.0") == 1, "静态服务应当绑 0.0.0.0"


def test_failure_shows_the_log_instead_of_just_timing_out(source: str) -> None:
    """起不来时最没用的输出是「超时」。得把日志尾巴打出来。"""
    up = source[source.index("cmd_up()") : source.index("cmd_status()")]
    assert up.count("tail -n") >= 2, "退出和超时两条路径都要打日志"


def test_the_readme_documents_both_commands(source: str) -> None:
    """记不住就等于没有。两条命令都要在 ops/README.md 里。"""
    readme = (SCRIPT.parents[1] / "README.md").read_text(encoding="utf-8")
    assert "dev.sh up" in readme
    assert "npm run verify" in readme
    # 那张「哪条命令覆盖什么」的表是这次的重点，不能丢。
    assert "重建 bundle" in readme


# ---------------------------------------------------------------- 真跑一遍 bash


def _argv(*extra: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    """跑 `dev.sh argv`，它只组装参数,不碰端口也不起进程。"""
    import os

    run_env = {k: v for k, v in os.environ.items() if k not in ("RUST_API_KEYS", "API_HOST")}
    run_env.update(env or {})
    return subprocess.run(
        ["bash", str(SCRIPT), "argv", *extra],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
        env=run_env,
    )


def _host(done: subprocess.CompletedProcess[str]) -> str:
    assert done.returncode == 0, done.stderr
    args = done.stdout.split()
    return args[args.index("--host") + 1]


def test_the_backend_binds_all_interfaces_with_a_real_key() -> None:
    """key 不是默认值时，后端照既定做法绑 0.0.0.0。"""
    assert _host(_argv(env={"RUST_API_KEYS": "some-real-key"})) == "0.0.0.0"


def test_the_backend_falls_back_to_loopback_with_the_default_key() -> None:
    """key 还是默认的 dev-local-key（或没有 key）时，dev_stack.py 拒绝在非本机地址上监听，
    绑 0.0.0.0 的 `up` 必然起不来。这时退回 127.0.0.1。

    起因（2026-10-22）：本地 key 是默认值，`dev.sh up` 报 "a non-default RUST_API_KEYS
    value is required for non-loopback listening" 退出。
    """
    assert _host(_argv(env={"RUST_API_KEYS": "dev-local-key"})) == "127.0.0.1"
    assert _host(_argv(env={"RUST_API_KEYS": "other,dev-local-key"})) == "127.0.0.1"
    assert _host(_argv()) == "127.0.0.1"


def test_an_explicit_host_wins() -> None:
    """`up --host <地址>` 设的 API_HOST 压过自动选择。"""
    assert _host(_argv(env={"RUST_API_KEYS": "some-real-key", "API_HOST": "127.0.0.1"})) == "127.0.0.1"


def test_dev_sh_and_dev_stack_agree_on_the_default_key(source: str) -> None:
    """两边的默认 key 写法要一致，不然退回本机的判断会失效。"""
    import re

    stack = (SCRIPT.parent / "dev_stack.py").read_text(encoding="utf-8")
    stack_default = re.search(r'^DEFAULT_API_KEY = "([^"]+)"', stack, re.M).group(1)
    assert f'DEFAULT_API_KEY="{stack_default}"' in source


def test_up_accepts_host_option(source: str) -> None:
    up = source[source.index("cmd_up() {") : source.index("cmd_status() {")]
    assert "--host)" in up and "--host=*)" in up


def test_the_backend_argv_assembles_under_the_system_bash() -> None:
    """**这一条是真跑 bash,不是读文本。**

    起因:`dev.sh up`（不带 --fast,也就是改过 Rust 之后必须走的那条）一直是坏的。
    macOS 自带 bash 3.2,`set -u` 下展开**空数组**会报 `unbound variable`,而
    `--fast` 那条因为数组非空反而正常 —— 于是只在最需要它的时候失败。

    读文本的门禁挡不住这个:`"${build_flag[@]}"` 看起来完全正常。只有在真正的
    bash 里跑一遍才会红。
    """
    done = _argv()
    assert done.returncode == 0, f"不带 --fast 的参数组装失败了:\n{done.stderr}"
    args = done.stdout.split()
    assert "--no-build" not in args, "不带 --fast 却跳过了构建 —— 改了 Rust 不会重编"
    for flag in ("--host", "--port", "--data-root", "--no-sync"):
        assert flag in args, f"少了 {flag}"

    fast = _argv("--fast")
    assert fast.returncode == 0, fast.stderr
    assert "--no-build" in fast.stdout.split(), "--fast 没有跳过构建"


def test_up_actually_uses_the_function_that_is_guarded(source: str) -> None:
    """门禁守的是 `stack_argv`,所以 `cmd_up` 必须真的走它。

    反证时发现的洞:把参数内联回 cmd_up,上面那条照样绿 —— 它验的是一个没人用的
    函数。真实路径不经过被守的代码,等于没守。
    """
    up_block = source[source.index("cmd_up() {") : source.index("cmd_status() {")]
    assert "stack_argv" in up_block, "cmd_up 不再走 stack_argv,门禁管不到真实路径了"
    assert "--data-root" not in up_block, "参数又被内联回 cmd_up 了"


def test_same_origin_is_an_option_of_up_not_a_second_launcher(source: str) -> None:
    """同源转发收在 `up` 里,不再单独维护第二个启动脚本。

    它绕的是 WSL2 的 localhost 转发按端口失效(40001 通、41000 不通),属于
    特定环境的绕行,所以必须是**选项**而不是默认;默认仍走 serve_static。
    """
    up_block = source[source.index("cmd_up() {") : source.index("cmd_status() {")]
    assert "serve_same_origin.py" in up_block, "同源选项没有接到静态服务上"
    assert "serve_static.py" in up_block, "默认路径被换掉了 —— 同源应当是选项"
    assert "--api-base" in up_block, "同源时没告诉代理后端在哪"


def test_the_system_bash_is_the_one_that_has_this_trap() -> None:
    """把「为什么要上面那条」钉死,而不是只留一句注释。

    bash 3.2 下 `set -u` + 空数组展开会失败,4.4+ 已经不会了。哪天 macOS 换了
    默认 bash,上面那条仍然绿,但这一条会红 —— 那时可以把这两条一起删掉,而不是
    让一条没人记得为什么存在的规则留在仓库里。
    """
    probe = subprocess.run(
        ["bash", "-c", 'set -u; arr=(); printf "%s" "${arr[@]}"'],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if probe.returncode == 0:
        pytest.skip("这个系统的 bash 已经不会在空数组上炸了,上面那条门禁可以退休")
    assert "unbound" in probe.stderr.lower()


def test_no_bare_variable_runs_into_non_ascii_text(source: str) -> None:
    """`$VAR，` 这种写法在 macOS 自带的 bash 3.2 下会炸。

    起因（2026-10-22）：`echo "… $DEFAULT_API_KEY，后端只监听 …"` 在 UTF-8 环境下被
    bash 3.2 当成变量 `DEFAULT_API_KEY\\xef…`，加上 `set -u` 直接报 unbound variable，
    `dev.sh up` 不带 `--host` 起不来。变量后面紧跟中文标点、中文字时一律写成 `${VAR}`。
    """
    import re

    bad = [
        f"{n}: {line.strip()}"
        for n, line in enumerate(source.splitlines(), 1)
        if re.search(r"\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7f]", line)
    ]
    assert not bad, "变量后面紧跟非 ASCII 字符，要写成 ${VAR}：\n" + "\n".join(bad)


def test_the_system_bash_misreads_a_variable_followed_by_cjk_punctuation() -> None:
    """把上面那条的起因钉住：系统 bash 在 UTF-8 下确实会这样读错。

    哪天系统 bash 不再这样了，这条会跳过，上面那条可以一起退休。
    """
    import os

    env = dict(os.environ, LANG="en_US.UTF-8", LC_ALL="en_US.UTF-8")
    probe = subprocess.run(
        ["/bin/bash", "-c", 'set -u; X=1; echo "$X，"'],
        capture_output=True,
        timeout=30,
        check=False,
        env=env,
    )
    # 报错里的变量名带着半个 UTF-8 字符，按字节看，不按文本解码。
    if probe.returncode == 0:
        pytest.skip("这个系统的 bash 不会把中文标点读进变量名")
    assert b"unbound" in probe.stderr.lower()


def test_the_backend_gets_time_for_a_database_upgrade() -> None:
    """升级库结构时后端先压缩备份整个库，1.4GB 要 1 分多钟（2026-11-20）。以前 dev_stack 只等 60 秒，升级那次被当成失败停掉。"""
    def timeout(env: dict[str, str] | None = None) -> str:
        done = _argv(env=env)
        assert done.returncode == 0, done.stderr
        args = done.stdout.split()
        return args[args.index("--readiness-timeout") + 1]

    assert float(timeout()) >= 300
    assert timeout({"DEV_STACK_READINESS_TIMEOUT": "900"}) == "900"
