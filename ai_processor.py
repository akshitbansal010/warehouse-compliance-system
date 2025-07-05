import os
import json
import fitz  # PyMuPDF
import openai
import anthropic
from typing import Dict, List, Optional, Any
from docx import Document
from dotenv import load_dotenv

load_dotenv()

# Initialize API clients
openai.api_key = os.getenv("OPENAI_API_KEY")
anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from PDF using PyMuPDF."""
    try:
        doc = fitz.open(file_path)
        text = ""
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text += page.get_text()
            text += "\n\n"  # Add spacing between pages
        
        doc.close()
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    """Extract text content from DOCX file."""
    try:
        doc = Document(file_path)
        text = ""
        
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

def extract_text_from_file(file_path: str) -> str:
    """Extract text from various file formats."""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.pdf':
        return extract_text_from_pdf(file_path)
    elif file_extension in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    elif file_extension == '.txt':
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    else:
        raise Exception(f"Unsupported file format: {file_extension}")

def parse_routing_guide_with_ai(text_content: str, use_openai: bool = True) -> Dict[str, Any]:
    """Parse routing guide using OpenAI or Claude API."""
    prompt = f"""
    Please analyze the following routing guide document and extract structured information.
    
    Extract the following information and return as JSON:
    1. Document title and version
    2. Packaging rules and requirements
    3. Label placement instructions
    4. Carrier-specific requirements
    5. Special handling instructions
    6. Quality control checkpoints
    7. Documentation requirements
    8. Any other important operational guidelines
    
    Document content:
    {text_content}
    
    Please return the response as a valid JSON object with the following structure:
    {{
        "title": "document title",
        "version": "version if available",
        "packaging_rules": [list of packaging rules],
        "label_placement": [list of label placement instructions],
        "carrier_requirements": {{carrier: [requirements]}},
        "special_handling": [list of special handling instructions],
        "quality_checkpoints": [list of quality control points],
        "documentation": [list of documentation requirements],
        "other_guidelines": [list of other important guidelines]
    }}
    """
    
    try:
        if use_openai and openai.api_key:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert in warehouse operations and document analysis. Extract structured information from routing guides and return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
        
        elif anthropic_client:
            response = anthropic_client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=2000,
                temperature=0,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            content = response.content[0].text
            return json.loads(content)
        
        else:
            raise Exception("No AI API keys configured")
            
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse AI response as JSON: {str(e)}")
    except Exception as e:
        raise Exception(f"AI processing failed: {str(e)}")

def extract_packaging_rules(parsed_content: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract and structure packaging rules from parsed content."""
    packaging_rules = []
    
    # Extract from main packaging rules section
    if "packaging_rules" in parsed_content:
        for rule in parsed_content["packaging_rules"]:
            packaging_rules.append({
                "type": "packaging",
                "rule": rule,
                "priority": "standard",
                "category": "general"
            })
    
    # Extract carrier-specific packaging requirements
    if "carrier_requirements" in parsed_content:
        for carrier, requirements in parsed_content["carrier_requirements"].items():
            for req in requirements:
                if any(keyword in req.lower() for keyword in ["package", "box", "wrap", "protect"]):
                    packaging_rules.append({
                        "type": "packaging",
                        "rule": req,
                        "priority": "carrier_specific",
                        "category": carrier,
                        "carrier": carrier
                    })
    
    # Extract special handling that affects packaging
    if "special_handling" in parsed_content:
        for handling in parsed_content["special_handling"]:
            if any(keyword in handling.lower() for keyword in ["fragile", "hazmat", "temperature", "orientation"]):
                packaging_rules.append({
                    "type": "packaging",
                    "rule": handling,
                    "priority": "special",
                    "category": "special_handling"
                })
    
    return packaging_rules

def extract_label_placement_rules(parsed_content: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract and structure label placement rules from parsed content."""
    label_rules = []
    
    # Extract from main label placement section
    if "label_placement" in parsed_content:
        for rule in parsed_content["label_placement"]:
            label_rules.append({
                "type": "label_placement",
                "rule": rule,
                "priority": "standard",
                "category": "general"
            })
    
    # Extract carrier-specific labeling requirements
    if "carrier_requirements" in parsed_content:
        for carrier, requirements in parsed_content["carrier_requirements"].items():
            for req in requirements:
                if any(keyword in req.lower() for keyword in ["label", "barcode", "address", "tracking"]):
                    label_rules.append({
                        "type": "label_placement",
                        "rule": req,
                        "priority": "carrier_specific",
                        "category": carrier,
                        "carrier": carrier
                    })
    
    # Extract documentation requirements that affect labeling
    if "documentation" in parsed_content:
        for doc_req in parsed_content["documentation"]:
            if any(keyword in doc_req.lower() for keyword in ["label", "attach", "affix", "place"]):
                label_rules.append({
                    "type": "label_placement",
                    "rule": doc_req,
                    "priority": "documentation",
                    "category": "documentation"
                })
    
    return label_rules

def process_document_upload(file_path: str, original_filename: str) -> Dict[str, Any]:
    """Process uploaded document and extract all relevant information."""
    try:
        # Extract text from file
        text_content = extract_text_from_file(file_path)
        
        if not text_content.strip():
            raise Exception("No text content found in the document")
        
        # Parse with AI
        parsed_content = parse_routing_guide_with_ai(text_content)
        
        # Extract specific rule types
        packaging_rules = extract_packaging_rules(parsed_content)
        label_placement_rules = extract_label_placement_rules(parsed_content)
        
        # Combine all extracted information
        result = {
            "original_filename": original_filename,
            "text_content": text_content,
            "parsed_content": parsed_content,
            "packaging_rules": packaging_rules,
            "label_placement_rules": label_placement_rules,
            "total_rules_extracted": len(packaging_rules) + len(label_placement_rules),
            "processing_status": "success",
            "ai_extracted_rules": {
                "packaging": packaging_rules,
                "label_placement": label_placement_rules,
                "total_count": len(packaging_rules) + len(label_placement_rules)
            }
        }
        
        return result
        
    except Exception as e:
        return {
            "original_filename": original_filename,
            "processing_status": "error",
            "error_message": str(e),
            "ai_extracted_rules": {
                "packaging": [],
                "label_placement": [],
                "total_count": 0
            }
        }

def validate_extracted_rules(rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate extracted rules for completeness and consistency."""
    validation_result = {
        "is_valid": True,
        "warnings": [],
        "errors": [],
        "statistics": {
            "total_rules": len(rules),
            "packaging_rules": 0,
            "label_rules": 0,
            "carrier_specific": 0,
            "special_handling": 0
        }
    }
    
    for rule in rules:
        # Count rule types
        if rule.get("type") == "packaging":
            validation_result["statistics"]["packaging_rules"] += 1
        elif rule.get("type") == "label_placement":
            validation_result["statistics"]["label_rules"] += 1
        
        # Count priorities
        if rule.get("priority") == "carrier_specific":
            validation_result["statistics"]["carrier_specific"] += 1
        elif rule.get("priority") == "special":
            validation_result["statistics"]["special_handling"] += 1
        
        # Validate rule structure
        if not rule.get("rule"):
            validation_result["errors"].append(f"Rule missing content: {rule}")
            validation_result["is_valid"] = False
        
        if not rule.get("type"):
            validation_result["warnings"].append(f"Rule missing type classification: {rule}")
    
    return validation_result
