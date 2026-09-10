use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let target = env::var("TARGET").unwrap_or_default();
    if target != "i686-pc-windows-gnu" {
        return;
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR must be set"));
    let def_path = out_dir.join("ws2_32_gethostnamew.def");
    let lib_path = out_dir.join("libws2_32_gethostnamew.a");

    fs::write(
        &def_path,
        "LIBRARY ws2_32.dll\nEXPORTS\n    GetHostNameW@8\n",
    )
    .expect("failed to write ws2_32 def file");

    let status = Command::new("i686-w64-mingw32-dlltool")
        .args([
            "-d",
            def_path.to_str().expect("def path must be utf-8"),
            "-l",
            lib_path.to_str().expect("lib path must be utf-8"),
            "-k",
        ])
        .status()
        .expect("failed to invoke i686-w64-mingw32-dlltool");

    if !status.success() {
        panic!("i686-w64-mingw32-dlltool failed");
    }

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=dylib=ws2_32_gethostnamew");
}
