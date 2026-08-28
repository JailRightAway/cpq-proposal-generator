import pandas as pd
import json
import os

# Read the Excel file
input_file = '/sessions/peaceful-wonderful-darwin/mnt/uploads/ML_PriceCard.xlsm'
output_dir = '/sessions/peaceful-wonderful-darwin/mnt/outputs'

# Get all sheet names
xls = pd.ExcelFile(input_file)
sheet_names = xls.sheet_names

print(f"Found sheets: {sheet_names}\n")

# Dictionary to store all data
all_data = {}

# Process each sheet
for sheet_name in sheet_names:
    print(f"Processing sheet: {sheet_name}")
    
    # Read the sheet
    df = pd.read_excel(input_file, sheet_name=sheet_name)
    
    # Save to CSV
    csv_filename = os.path.join(output_dir, f"{sheet_name}.csv")
    df.to_csv(csv_filename, index=False)
    print(f"  ✓ Saved to {sheet_name}.csv")
    
    # Store data for JSON
    all_data[sheet_name] = df.to_dict(orient='records')

# Create JSON file with all sheets
json_filename = os.path.join(output_dir, "ML_PriceCard.json")
with open(json_filename, 'w') as f:
    json.dump(all_data, f, indent=2, default=str)
print(f"\n✓ Saved combined JSON to ML_PriceCard.json")

# Also create individual JSON files per sheet for convenience
for sheet_name in sheet_names:
    json_file = os.path.join(output_dir, f"{sheet_name}.json")
    with open(json_file, 'w') as f:
        json.dump(all_data[sheet_name], f, indent=2, default=str)
    print(f"✓ Saved individual JSON: {sheet_name}.json")

print(f"\n📊 Summary:")
for sheet_name in sheet_names:
    rows = len(all_data[sheet_name])
    cols = len(all_data[sheet_name][0]) if all_data[sheet_name] else 0
    print(f"  {sheet_name}: {rows} rows × {cols} columns")

