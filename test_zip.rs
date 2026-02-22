use std::fs::File;
fn main() {
    let f = File::create("test.zip").unwrap();
    let mut zip = zip::ZipWriter::new(f);
    let options = zip::write::SimpleFileOptions::default();
    zip.start_file("hello.txt", options).unwrap();
}
