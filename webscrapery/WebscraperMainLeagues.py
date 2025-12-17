import time
import pandas as pd
from sqlalchemy import create_engine
from mwrogue.esports_client import EsportsClient
from mwclient.errors import APIError

# ==========================================
# KONFIGURACJA
# ==========================================

# Dane do bota (zeby nie dostac bana na IP)
BOT_USER = 'SiroN1@MaciekScraper'
BOT_PASS = 'krbijj35b21vgo0b378q834gfmf8gikp'

# Dane do bazy SQL
DB_SERVER = 'LOCALHOST'
DB_NAME = 'LoLProDraft'
DRIVER = 'ODBC Driver 17 for SQL Server'

# Od kiedy pobieramy dane (2022 to dobry start)
START_DATE = '2022-01-01'


def pobierz_wszystko():
    # Laczenie z API Leaguepedii
    client = EsportsClient('lol')

    print(f"Loguje sie jako: {BOT_USER}...")
    try:
        client.client.login(username=BOT_USER, password=BOT_PASS)
        print("Zalogowano pomyślnie.")
    except Exception as e:
        print(f"Cos poszlo nie tak z logowaniem: {e}")
        return pd.DataFrame()

    # Regiony tier 2, ktore nas interesuja (Europa, Korea, Chiny, NA)
    regiony_tier2 = "'Europe', 'Korea', 'China', 'North America'"

    paczka = 500  # Ile gier na raz pobieramy
    offset = 0
    lista_gier = []

    print(f"Start pobierania (Tier 1 + ERL)...")

    while True:
        try:
            print(f">> Pobieram od wiersza: {offset}...", end="")

            # Zapytanie do Cargo (to ich baza danych)
            response = client.cargo_client.query(
                tables="ScoreboardGames=SG, PicksAndBansS7=PB, Tournaments=T",
                join_on="SG.GameId=PB.GameId, SG.OverviewPage=T.OverviewPage",
                fields="SG.DateTime_UTC, SG.Patch, T.League, T.Region, T.TournamentLevel, "
                       "SG.Team1, SG.Team2, SG.WinTeam, "
                       "PB.Team1Ban1, PB.Team2Ban1, PB.Team1Ban2, PB.Team2Ban2, PB.Team1Ban3, PB.Team2Ban3, "
                       "PB.Team1Pick1, PB.Team2Pick1, PB.Team2Pick2, PB.Team1Pick2, PB.Team1Pick3, PB.Team2Pick3, "
                       "PB.Team2Ban4, PB.Team1Ban4, PB.Team2Ban5, PB.Team1Ban5, "
                       "PB.Team2Pick4, PB.Team1Pick4, PB.Team1Pick5, PB.Team2Pick5",
                # Logika: Data >= 2022 ORAZ (Primary/International LUB Secondary z naszych regionow)
                where=(
                    f"SG.DateTime_UTC >= '{START_DATE}' "
                    f"AND PB.Team1Pick1 IS NOT NULL "
                    f"AND ("
                    f"  T.TournamentLevel IN ('Primary', 'International') "
                    f"  OR "
                    f"  (T.TournamentLevel = 'Secondary' AND T.Region IN ({regiony_tier2}))"
                    f")"
                ),
                limit=paczka,
                offset=offset,
                order_by="SG.DateTime_UTC DESC"
            )

            if not response:
                print(" -> Pusto, koniec danych.")
                break

            ile = len(response)
            print(f" -> Przyszlo {ile} rekordow.")

            lista_gier.extend(response)
            offset += ile

            # Krotka przerwa dla bezpieczenstwa
            time.sleep(1)

        except APIError as e:
            if e.code == 'ratelimited':
                print("\nZa duzo zapytan (Rate Limit). Czekam 65s...")
                time.sleep(65)
                continue
            else:
                print(f"\nBlad API: {e}")
                time.sleep(10)
                continue
        except Exception as e:
            # Jak zerwie neta, to czekamy i probujemy dalej
            print(f"\nWywalilo polaczenie: {e}")
            print("Czekam 60s i ponawiam...")
            time.sleep(60)
            continue

    if not lista_gier:
        return pd.DataFrame()

    print(f"\nPrzetwarzanie {len(lista_gier)} gier...")
    df = pd.DataFrame(lista_gier)

    # Podglad co pobralo (dla pewnosci)
    if 'League' in df.columns:
        print("\nTop 20 lig w bazie:")
        print(df['League'].value_counts().head(20))
        print("-" * 20)

    # Zmiana nazw kolumn na takie jak w SQL Server
    nowe_nazwy = {
        'DateTime UTC': 'Date', 'DateTime_UTC': 'Date', 'DateTime': 'Date',
        'Team1': 'BlueTeamID', 'Team2': 'RedTeamID', 'WinTeam': 'Winner',
        'Patch': 'PatchVersion', 'Region': 'Region', 'League': 'LeagueName',
        'Team1Ban1': 'BanBlue1', 'Team2Ban1': 'BanRed1', 'Team1Ban2': 'BanBlue2', 'Team2Ban2': 'BanRed2',
        'Team1Ban3': 'BanBlue3', 'Team2Ban3': 'BanRed3',
        'Team1Pick1': 'PickBlue1', 'Team2Pick1': 'PickRed1', 'Team2Pick2': 'PickRed2', 'Team1Pick2': 'PickBlue2',
        'Team1Pick3': 'PickBlue3', 'Team2Pick3': 'PickRed3',
        'Team2Ban4': 'BanRed4', 'Team1Ban4': 'BanBlue4', 'Team2Ban5': 'BanRed5', 'Team1Ban5': 'BanBlue5',
        'Team2Pick4': 'PickRed4', 'Team1Pick4': 'PickBlue4', 'Team1Pick5': 'PickBlue5', 'Team2Pick5': 'PickRed5'
    }

    df = df.rename(columns=nowe_nazwy)

    if 'Winner' in df.columns and 'BlueTeamID' in df.columns:
        df['BlueWin'] = (df['Winner'] == df['BlueTeamID']).astype(int)

    # Wybieram tylko te kolumny ktore sa w bazie
    kolumny_bazy = [
        'Date', 'LeagueName', 'Region', 'PatchVersion', 'BlueTeamID', 'RedTeamID', 'Winner', 'BlueWin',
        'BanBlue1', 'BanRed1', 'BanBlue2', 'BanRed2', 'BanBlue3', 'BanRed3',
        'PickBlue1', 'PickRed1', 'PickRed2', 'PickBlue2', 'PickBlue3', 'PickRed3',
        'BanRed4', 'BanBlue4', 'BanRed5', 'BanBlue5',
        'PickRed4', 'PickBlue4', 'PickBlue5', 'PickRed5'
    ]

    # Filtruje tylko te co istnieja
    df = df[[c for c in kolumny_bazy if c in df.columns]]

    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'])

    return df


def zapisz_baze(df):
    if df.empty:
        print("Nie ma co zapisywac.")
        return

    # TUTAJ BYL BLAD - TERAZ UZYWAMY POPRAWNYCH ZMIENNYCH
    conn_str = f"mssql+pyodbc://{DB_SERVER}/{DB_NAME}?driver={DRIVER}&trusted_connection=yes"

    try:
        engine = create_engine(conn_str)
        # REPLACE = czysci stara tabele i wrzuca nowa calosc (czysta baza)
        print(f"Wrzucam {len(df)} wierszy do bazy (REPLACE)...")
        df.to_sql('Drafts', engine, if_exists='replace', index=False, chunksize=200)
        print("Udalo sie, dane w bazie!")
    except Exception as e:
        print(f"Blad SQL: {e}")


if __name__ == "__main__":
    dane = pobierz_wszystko()
    if not dane.empty:
        zapisz_baze(dane)