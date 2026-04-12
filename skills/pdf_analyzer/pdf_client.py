#!/usr/bin/env python3
"""
PDF Analyzer Client
Analyzes PDF documents including text extraction, image OCR, and metadata.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

try:
    import pdfplumber
    import PyPDF2
except ImportError:
    print(json.dumps({"error": "PDF libraries not installed. Install: pip install pdfplumber PyPDF2"}))
    sys.exit(1)

# Optional dependencies for OCR
try:
    import pdf2image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("Warning: OCR not available. Install: pip install pdf2image pytesseract", file=sys.stderr)


def extract_text(pdf_path):
    """Extract text from PDF using pdfplumber"""
    try:
        text = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text.append(f"--- Page {page_num} ---\n{page_text}")
        return "\n\n".join(text)
    except Exception as e:
        return f"Error extracting text: {str(e)}"


def extract_images_with_ocr(pdf_path):
    """Extract images from PDF and perform OCR"""
    if not OCR_AVAILABLE:
        return "OCR not available. Install pdf2image and pytesseract."

    try:
        images_text = []
        # Convert PDF to images
        images = pdf2image.convert_from_path(pdf_path)

        for i, image in enumerate(images, 1):
            try:
                # Perform OCR
                text = pytesseract.image_to_string(image)
                if text.strip():
                    images_text.append(f"--- Page {i} Image OCR ---\n{text}")
            except Exception as e:
                images_text.append(f"--- Page {i} Image OCR ---\nError: {str(e)}")

        return "\n\n".join(images_text) if images_text else "No text found in images"
    except Exception as e:
        return f"Error performing OCR: {str(e)}"


def get_metadata(pdf_path):
    """Get PDF metadata using PyPDF2"""
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)

            metadata = {
                "pages": len(reader.pages),
                "title": reader.metadata.get('/Title', 'Unknown') if reader.metadata else 'Unknown',
                "author": reader.metadata.get('/Author', 'Unknown') if reader.metadata else 'Unknown',
                "subject": reader.metadata.get('/Subject', 'Unknown') if reader.metadata else 'Unknown',
                "creator": reader.metadata.get('/Creator', 'Unknown') if reader.metadata else 'Unknown',
                "creation_date": reader.metadata.get('/CreationDate', 'Unknown') if reader.metadata else 'Unknown',
                "modification_date": reader.metadata.get('/ModDate', 'Unknown') if reader.metadata else 'Unknown',
                "is_encrypted": reader.is_encrypted
            }

            # Add file size
            metadata["file_size_bytes"] = os.path.getsize(pdf_path)

            return metadata
    except Exception as e:
        return {"error": f"Error reading metadata: {str(e)}"}


def analyze_pdf(pdf_path):
    """Perform complete PDF analysis"""
    result = {
        "metadata": get_metadata(pdf_path),
        "text": extract_text(pdf_path),
        "images_ocr": extract_images_with_ocr(pdf_path),
        "analyzed_at": datetime.now().isoformat()
    }
    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: pdf_client.py <command> --pdf-path <path>"}))
        sys.exit(1)

    command = sys.argv[1]

    # Parse --pdf-path argument
    pdf_path = None
    if "--pdf-path" in sys.argv:
        try:
            idx = sys.argv.index("--pdf-path")
            if idx + 1 < len(sys.argv):
                pdf_path = sys.argv[idx + 1]
        except (ValueError, IndexError):
            pass

    if not pdf_path:
        print(json.dumps({"error": "PDF path required via --pdf-path argument"}))
        sys.exit(1)

    # Check if file exists
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)

    # Execute command
    if command == "extract-text":
        result = {"text": extract_text(pdf_path)}
    elif command == "extract-images":
        result = {"images_ocr": extract_images_with_ocr(pdf_path)}
    elif command == "metadata":
        result = {"metadata": get_metadata(pdf_path)}
    elif command == "analyze":
        result = analyze_pdf(pdf_path)
    else:
        result = {"error": f"Unknown command: {command}. Use: extract-text, extract-images, metadata, analyze"}

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
