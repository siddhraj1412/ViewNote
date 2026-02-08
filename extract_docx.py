import sys
import zipfile
import re
import os

def extract_text(docx_path):
    if not os.path.exists(docx_path):
        return f"Error: File not found: {docx_path}"
    try:
        with zipfile.ZipFile(docx_path) as document:
            xml_content = document.read('word/document.xml').decode('utf-8')
            # Replace paragraph endings with newlines
            xml_content = re.sub(r'</w:p>', '\n', xml_content)
            # Remove all tags
            text = re.sub(r'<[^>]+>', '', xml_content)
            return text
    except Exception as e:
        return f"Error reading {docx_path}: {str(e)}"

if __name__ == "__main__":
    for filename in sys.argv[1:]:
        print(f"Processing {filename}...")
        text = extract_text(filename)
        out_filename = filename + ".txt"
        with open(out_filename, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Wrote to {out_filename}")
