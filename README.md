# LoL Pro Draft Analyzer 🎮

Projekt Full-Stack / Portfolio. Zaawansowane narzędzie do analizy i symulacji draftów w League of Legends, oparte na danych z profesjonalnych rozgrywek.

## 🚀 Jak to działa?
Projekt realizuje pełny proces przetwarzania danych (ETL):
1. **Extract (Scrapery):** Skrypty Python pobierają historię tysięcy meczy z API Leaguepedii (LCK, LPL, LEC, ERL).
2. **Transform & Load (SQL):** Dane są czyszczone i zapisywane w bazie MS SQL Server.
3. **Backend (FastAPI):** Silnik analityczny oblicza "ważony Winrate" (gdzie mecze Tier 1 mają większą wagę niż Tier 2) i wystawia API.
4. **Frontend (React):** Interfejs użytkownika pozwalający na symulację draftu "na żywo" z podpowiedziami AI.

## 🛠 Technologie
* **Backend:** Python, FastAPI, Pandas, NumPy, SQLAlchemy
* **Frontend:** React, Styled Components, Axios
* **Baza Danych:** Microsoft SQL Server
* **Dane:** Leaguepedia API (Cargo Query)

## 📦 Uruchomienie

### Wymagania wstępne
* Zainstalowany Python i Node.js
* Działająca lokalnie baza danych MSSQL o nazwie `LoLProDraft`

### Krok 1: Backend
1. Otwórz terminal w folderze projektu.
2. Wejdź do folderu backendu:
	```bash
	cd Backend
	```
3. Aktywuj środowisko wirtualne (Windows):
	```bash
	.\venv\Scripts\activate
	```
4. Uruchom serwer API:
	```bash
	uvicorn main:app --reload
	```
### Krok 2: Frontend
1. Otwórz nowe okno terminala.
2. Wejdź do folderu frontendu:
	```bash
	cd Frontend
	```
3. Zainstaluj biblioteki (tylko przy pierwszym uruchomieniu):
	```bash
	npm install
	```
4. Uruchom aplikację:
	```bash
	npm run dev
	```"# lol_draft_project" 
