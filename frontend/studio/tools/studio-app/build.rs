fn main() {
    // The blog the app is built for (build.sh); read with option_env! in main.rs.
    println!("cargo:rerun-if-env-changed=STUDIO_REPO");
    tauri_build::build();
}
