@echo off
cd /d "%~dp0backend"
if not exist .venv py -m venv .venv
call .venv\Scripts\activate.bat
if not exist .env copy .env.example .env
python -m pip install -r requirements.txt
python scripts\import_kaggle_kcet.py
python scripts\import_kaggle_josaa.py
python -m uvicorn app.main:app --reload
pause
