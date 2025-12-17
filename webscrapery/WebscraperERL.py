import time
import pandas as pd
from sqlalchemy import create_engine
from mwrogue.esports_client import EsportsClient
from mwclient.errors import APIError

# Config bota i bazy
BOT_USER = 'SiroN1@MaciekScraper'
BOT_PASS = 'krbijj35b21vgo0b378q834gfmf8gikp'

DB_SERVER = 'LOCALHOST'
DB_NAME = 'LoLProDraft'
DRIVER = 'ODBC Driver 17 for SQL Server'

START_DATE = '2025-01-01'


def pobierz_erl_2025():
    client = EsportsClient('lol')

    print(f"Logowanie bota: {BOT_USER}...")
    try:
        client.client.login(username=BOT_USER, password=BOT_PASS)
        print("Zalogowano.")
    except Exception as e:
        print(f"Problem z logowaniem: {e}")
        return pd.DataFrame()

    # Lista lig, na których mi zależy
    moje_ligi = [
        'LFL', 'La Ligue Française', 'Ultraliga',
        'LVP SuperLiga', 'SuperLiga', 'Prime League', 'Prime League 1st Division',
        'EMEA Masters', 'European Masters', 'NLC', 'Hitpoint Masters',
        'EBL', 'LPLOL', 'GLL', 'TCL'
    ]
    ligi_str = "'" + "', '".join(moje_ligi) + "'"

    # Regiony tier 2
    regiony = "'Europe', 'EMEA'"

    limit = 500
    offset = 0
    dane = []

    print(f"Start pobierania (ERL 2025+)")

    while True:
        try:
            print(f">> Offset: {offset}...", end="")

            # Cargo query
            response = client.cargo_client.query(
                tables="ScoreboardGames=SG, PicksAndBansS7=PB, Tournaments=T",
                join_on="SG.GameId=PB.GameId, SG.OverviewPage=T.OverviewPage",
                fields="SG.DateTime_UTC, SG.Patch, T.League, T.Region, T.TournamentLevel, "
                       "SG.Team1, SG.Team2, SG.WinTeam, "
                       "PB.Team1Ban1, PB.Team2Ban1, PB.Team1Ban2, PB.Team2Ban2, PB.Team1Ban3, PB.Team2Ban3, "
                       "PB.Team1Pick1, PB.Team2Pick1, PB.Team2Pick2, PB.Team1Pick2, PB.Team1Pick3, PB.Team2Pick3, "
                       "PB.Team2Ban4, PB.Team1Ban4, PB.Team2Ban5, PB.Team1Ban5, "
                       "PB.Team2Pick4, PB.Team1Pick4, PB.Team1Pick5, PB.Team2Pick5",
                where=(
                    f"SG.DateTime_UTC >= '{START_DATE}' "
                    f"AND PB.Team1Pick1 IS NOT NULL "
                    f"AND ("
                    f"  (T.TournamentLevel = 'Secondary' AND T.Region IN ({regiony})) "
                    f"  OR "
                    f"  T.League IN ({ligi_str}) "
                    f")"
                ),
                limit=limit,
                offset=offset,
                order_by="SG.DateTime_UTC DESC"
            )

            if not response:
                print(" -> Koniec danych.")
                break

            count = len(response)
            print(f" -> Pobrało {count} wierszy.")
            dane.extend(response)
            offset += count
            time.sleep(1)

        except APIError as e:
            if e.code == 'ratelimited':
                print("\nRate limit! Czekam 65s...")
                time.sleep(65)
                continue
            else:
                print(f"\nBlad API: {e}")
                time.sleep(10)
                continue
        except Exception as e:
            print(f"\nBlad polaczenia: {e}. Ponawiam za minute.")
            time.sleep(60)
            continue

    if not dane:
        return pd.DataFrame()

    print(f"Przetwarzanie {len(dane)} rekordow...")
    df = pd.DataFrame(dane)

    # Sprawdzenie co pobralo
    if 'League' in df.columns:
        print("\nZnalezione ligi:")
        print(df['League'].value_counts().head(15))
        print("-" * 20)

    # Mapowanie na nasza baze
    mapa_nazw = {
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

    df = df.rename(columns=mapa_nazw)

    if 'Winner' in df.columns and 'BlueTeamID' in df.columns:
        df['BlueWin'] = (df['Winner'] == df['BlueTeamID']).astype(int)

    # Wybieramy tylko potrzebne kolumny
    cols_to_keep = [
        'Date', 'LeagueName', 'Region', 'PatchVersion', 'BlueTeamID', 'RedTeamID', 'Winner', 'BlueWin',
        'BanBlue1', 'BanRed1', 'BanBlue2', 'BanRed2', 'BanBlue3', 'BanRed3',
        'PickBlue1', 'PickRed1', 'PickRed2', 'PickBlue2', 'PickBlue3', 'PickRed3',
        'BanRed4', 'BanBlue4', 'BanRed5', 'BanBlue5',
        'PickRed4', 'PickBlue4', 'PickBlue5', 'PickRed5'
    ]

    final_cols = [c for c in cols_to_keep if c in df.columns]
    df = df[final_cols]

    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'])

    return df


def zapisz_do_bazy(df):
    if df.empty:
        print("Brak danych do zapisu.")
        return

    conn_str = f"mssql+pyodbc://{DB_SERVER}/{DB_NAME}?driver={DRIVER}&trusted_connection=yes"

    try:
        engine = create_engine(conn_str)
        print(f"Dopychamy {len(df)} wierszy do tabeli Drafts (append)...")
        # if_exists='append' bo nie chcemy kasowac starej historii
        df.to_sql('Drafts', engine, if_exists='append', index=False, chunksize=200)
        print("Gotowe.")
    except Exception as e:
        print(f"Blad SQL: {e}")


if __name__ == "__main__":
    df_erl = pobierz_erl_2025()
    if not df_erl.empty:
        zapisz_do_bazy(df_erl)