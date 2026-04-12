# PDF Analyzer Skill

Analyzes uploaded PDF documents including astrological charts, horoscopes, and birth charts.

## Commands

### Extract Text
Extracts all readable text from PDF.

```bash
python3 ~/.openclaw/skills/pdf_analyzer/pdf_client.py extract-text --pdf-path "/path/to/file.pdf"
```

### Extract Images (OCR)
Extracts and performs OCR on images within PDF.

```bash
python3 ~/.openclaw/skills/pdf_analyzer/pdf_client.py extract-images --pdf-path "/path/to/file.pdf"
```

### Get Metadata
Gets PDF structure and metadata.

```bash
python3 ~/.openclaw/skills/pdf_analyzer/pdf_client.py metadata --pdf-path "/path/to/file.pdf"
```

### Full Analysis
Performs complete analysis (text + images + metadata).

```bash
python3 ~/.openclaw/skills/pdf_analyzer/pdf_client.py analyze --pdf-path "/path/to/file.pdf"
```

## Output Format

JSON output with:
- **text**: Extracted text content from PDF
- **images_ocr**: OCR'd text from images within PDF
- **metadata**: PDF properties (pages, author, creation_date, title, etc.)
- **analyzed_at**: Timestamp of analysis

## Use Cases

- User uploads astrological chart PDF → Agent analyzes and explains content
- User uploads horoscope document → Agent extracts predictions and remedies
- User asks "What does this PDF say?" → Agent provides summary and answers questions
- User uploads birth chart → Agent extracts planetary positions and provides readings

## Requirements

- pdfplumber: For accurate text extraction
- PyPDF2: For PDF metadata and structure
- pdf2image: For converting PDF pages to images
- pytesseract: For OCR on images within PDFs
- Tesseract OCR engine: System dependency for OCR
