import uvicorn
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("=" * 65)
    print("  Starting ChronoRx Tech - Clinical Decision Support Backend")
    print("  Host: http://127.0.0.1:8000")
    print("  Docs: http://127.0.0.1:8000/docs")
    print("  Safety: AI-assisted reference information — verify with a clinician.")
    print("=" * 65)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
