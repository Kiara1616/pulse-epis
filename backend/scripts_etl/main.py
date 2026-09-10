import json
import logging
from datetime import datetime
from credly_api import CredlyScraper

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def extract():
    """
    Simulates extracting data from University DB (Emails) and Credly API.
    """
    logging.info("Starting Extract phase...")
    # 1. Simulate reading emails from university DB or Google Sheet
    student_emails = [
        "kz2023077087@virtual.upt.pe",
        "kz2022011044@virtual.upt.pe",
        "fake@virtual.upt.pe" # Should return no badges
    ]
    
    # 2. Extract badges from Credly
    scraper = CredlyScraper()
    raw_data = []
    
    for email in student_emails:
        badges = scraper.get_user_badges_by_email(email)
        for badge in badges:
            # Attach the email to the badge record for tracing
            badge["student_email"] = email
            raw_data.append(badge)
            
    return raw_data

def transform(raw_data):
    """
    Cleans and transforms raw data into aggregate BI metrics.
    """
    logging.info("Starting Transform phase...")
    
    # 1. Clean vendor names (e.g., "Amazon Web Services Training and Certification" -> "AWS")
    vendor_mapping = {
        "Amazon Web Services Training and Certification": "AWS",
        "Cisco": "Cisco",
        "Microsoft": "Microsoft"
    }
    
    # 2. Categorize levels (Simplified logic based on keywords)
    def determine_level(badge_name):
        name_lower = badge_name.lower()
        if "practitioner" in name_lower or "fundamentals" in name_lower:
            return "Fundamentals"
        elif "associate" in name_lower:
            return "Associate"
        elif "professional" in name_lower or "expert" in name_lower:
            return "Professional"
        return "Other"

    transformed_records = []
    for row in raw_data:
        clean_vendor = vendor_mapping.get(row["issuer_name"], "Otros")
        level = determine_level(row["badge_name"])
        
        # Calculate cohort (year of entry) from email using regex logic
        # Email format: kz2023077087@virtual.upt.pe
        email = row["student_email"]
        entry_year = email[2:6] if len(email) > 6 and email[2:6].isdigit() else "Unknown"
        
        transformed_records.append({
            "vendor": clean_vendor,
            "level": level,
            "entry_year": entry_year,
            "badge": row["badge_name"]
        })
        
    return transformed_records

def load(transformed_data):
    """
    Loads (Saves) the transformed data into a JSON file for the Next.js Dashboard.
    """
    logging.info("Starting Load phase...")
    
    # Aggregate data for the pie chart
    vendor_counts = {}
    for row in transformed_data:
        v = row["vendor"]
        vendor_counts[v] = vendor_counts.get(v, 0) + 1
        
    pie_chart_data = [{"name": k, "value": v} for k, v in vendor_counts.items()]
    
    final_output = {
        "last_updated": datetime.now().isoformat(),
        "total_records_processed": len(transformed_data),
        "vendorMarketShare": pie_chart_data,
        "raw_transformed": transformed_data
    }
    
    output_path = "output_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4)
        
    logging.info(f"ETL Complete! Data saved to {output_path}")

if __name__ == "__main__":
    raw = extract()
    transformed = transform(raw)
    load(transformed)
