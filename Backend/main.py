import pandas as pd
import numpy as np
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
from sqlalchemy import create_engine
import urllib.parse
from fastapi.middleware.cors import CORSMiddleware

# --- KONFIGURACJA ---
DB_SERVER = "localhost"
DB_NAME = "LoLProDraft"
DOMYSLNY_PATCH = "PRO-S15"

# Ile gier musi byc zeby brac pod uwage statystyki
MIN_GIER = 3
PROG_ROLI = 0.10

# Wagi dla lig (im lepsza liga tym wazniejszy mecz)
WAGI_LIG = {
    "World Championship": 1.5,
    "Mid-Season Invitational": 1.3,
    "LoL Champions Korea": 1.0,  # LCK
    "Tencent LoL Pro League": 1.0,  # LPL
    "LoL EMEA Championship": 0.95,  # LEC
    "League of Legends Championship Series": 0.9,  # LCS
    "LFL": 0.7,
    "La Ligue Française": 0.7,
    "Ultraliga": 0.5,
    "LVP SuperLiga": 0.5,
    "Prime League": 0.5,
    "LCK Challengers League": 0.5,
    "North American Challengers League": 0.4,
    "DEFAULT": 0.3
}

# Connection string do MSSQL (autoryzacja Windows)
params = urllib.parse.quote_plus(
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={DB_SERVER};DATABASE={DB_NAME};"
    f"Trusted_Connection=yes;TrustServerCertificate=yes;"
)
URL_BAZY = f"mssql+pyodbc:///?odbc_connect={params}"

# Kolejnosc pickowania (to sie rzadko zmienia)
KOLEJNOSC_DRAFTU = [
    {"type": "BAN", "side": "BLUE", "col": "BanBlue1"},
    {"type": "BAN", "side": "RED", "col": "BanRed1"},
    {"type": "BAN", "side": "BLUE", "col": "BanBlue2"},
    {"type": "BAN", "side": "RED", "col": "BanRed2"},
    {"type": "BAN", "side": "BLUE", "col": "BanBlue3"},
    {"type": "BAN", "side": "RED", "col": "BanRed3"},
    {"type": "PICK", "side": "BLUE", "col": "PickBlue1"},
    {"type": "PICK", "side": "RED", "col": "PickRed1"},
    {"type": "PICK", "side": "RED", "col": "PickRed2"},
    {"type": "PICK", "side": "BLUE", "col": "PickBlue2"},
    {"type": "PICK", "side": "BLUE", "col": "PickBlue3"},
    {"type": "PICK", "side": "RED", "col": "PickRed3"},
    {"type": "BAN", "side": "RED", "col": "BanRed4"},
    {"type": "BAN", "side": "BLUE", "col": "BanBlue4"},
    {"type": "BAN", "side": "RED", "col": "BanRed5"},
    {"type": "BAN", "side": "BLUE", "col": "BanBlue5"},
    {"type": "PICK", "side": "RED", "col": "PickRed4"},
    {"type": "PICK", "side": "BLUE", "col": "PickBlue4"},
    {"type": "PICK", "side": "BLUE", "col": "PickBlue5"},
    {"type": "PICK", "side": "RED", "col": "PickRed5"},
]

# Fixy na nazwy zeby Riot API widzialo obrazki
ALIASY_NAZW = {
    "drmundo": "DrMundo", "ksante": "KSante", "jarvaniv": "JarvanIV",
    "leesin": "LeeSin", "xinzhao": "XinZhao", "masteryi": "MasterYi",
    "missfortune": "MissFortune", "tahmkench": "TahmKench", "twistedfate": "TwistedFate",
    "aurelionsol": "AurelionSol", "kogmaw": "KogMaw", "reksai": "RekSai",
    "leblanc": "Leblanc",  # <--- POPRAWIONE (male 'b')
    "khazix": "KhaZix", "chogath": "ChoGath",
    "nunu": "Nunu", "nunuwillump": "Nunu", "renata": "Renata",
    "renataglasc": "Renata", "wukong": "MonkeyKing", "monkeyking": "MonkeyKing",
    "belveth": "Belveth", "velkoz": "VelKoz", "kai'sa": "Kaisa", "kaisa": "Kaisa"
}


def normalizuj_klucz(klucz: str) -> str:
    if not klucz: return ""
    return str(klucz).lower().replace(" ", "").replace("'", "").replace(".", "")


def ladna_nazwa(val: str) -> str:
    s = str(val).strip()
    if s in ["0", "None", "nan", ""]: return None
    k = normalizuj_klucz(s)
    if k in ALIASY_NAZW: return ALIASY_NAZW[k]
    return s.capitalize()


# --- MODELE PYDANTIC (Do API) ---
class Champion(BaseModel):
    id: str
    name: str
    lane: str = "Any"


class TeamState(BaseModel):
    bans: List[str]
    picks: List[Champion]


class DraftState(BaseModel):
    blue_team: TeamState
    red_team: TeamState
    current_turn_side: str
    excluded_champions: List[str] = []
    target_patch: str = DOMYSLNY_PATCH


# --- GLOWNA KLASA LOGIKI ---
class SilnikDraftu:
    def __init__(self):
        self.dane_surowe = pd.DataFrame()
        self.statystyki = pd.DataFrame()
        self.role_dynamiczne = {}
        self.polaczenie_sql = None
        self.aktywny_patch = None

        try:
            self.polaczenie_sql = create_engine(URL_BAZY)
            print(f">> Polaczono z SQL Server: {DB_NAME}")
            # Na start ladujemy domyslny patch
            self.przeladuj_dane(DOMYSLNY_PATCH)
        except Exception as e:
            print(f"Blad polaczenia z baza: {e}")

    def pobierz_patche(self) -> List[str]:
        try:
            df = pd.read_sql("SELECT DISTINCT PatchVersion FROM Drafts", self.polaczenie_sql)
            lista = df['PatchVersion'].dropna().unique().tolist()
            # Wywalamy jakies smieci typu 'S1' jesli sa
            czysta_lista = [p for p in lista if "S1" not in str(p)]
            czysta_lista.sort(reverse=True)
            return czysta_lista
        except Exception as e:
            print(f"Nie udalo sie pobrac patchy: {e}")
            return [DOMYSLNY_PATCH]

    def _daj_wage_ligi(self, nazwa_ligi: str) -> float:
        if not nazwa_ligi: return WAGI_LIG["DEFAULT"]

        # Szukamy czy nazwa ligi (np. "LVP SuperLiga") zawiera klucz z naszego slownika
        for klucz, waga in WAGI_LIG.items():
            if klucz in str(nazwa_ligi):
                return waga
        return WAGI_LIG["DEFAULT"]

    def przeladuj_dane(self, nowy_patch: str):
        # Jak juz mamy ten patch to nie ladujemy drugi raz
        if self.aktywny_patch == nowy_patch and not self.dane_surowe.empty:
            return

        print(f"--- [RELOAD] Laduje dane dla patcha: {nowy_patch} ---")
        self.aktywny_patch = nowy_patch

        try:
            # 1. Pobieramy liste patchy (zeby wziac ten + 2 poprzednie dla wiekszej probki)
            query_patches = "SELECT DISTINCT PatchVersion FROM Drafts"
            df_patches = pd.read_sql(query_patches, self.polaczenie_sql)

            def parsuj(p):
                try:
                    czesci = str(p).split('.'); return (int(czesci[0]), int(czesci[1]))
                except:
                    return (0, 0)

            wszystkie = sorted(df_patches['PatchVersion'].dropna().unique(), key=parsuj)

            # Znajdujemy indeks wybranego patcha
            idx = 0
            if nowy_patch in wszystkie:
                idx = wszystkie.index(nowy_patch)
            else:
                idx = len(wszystkie) - 1  # Ostatni dostepny

            # Bierzemy 3 ostatnie patche (obecny + 2 wstecz)
            start = max(0, idx - 2)
            wybrane = wszystkie[start: idx + 1]
            lista_str = "', '".join(wybrane)

            # 2. Pobieramy wlasciwe dane
            sql = f"SELECT * FROM Drafts WHERE PatchVersion IN ('{lista_str}')"
            self.dane_surowe = pd.read_sql(sql, self.polaczenie_sql)

            # 3. Dodajemy wage meczu (Wazne! LCK > ERL)
            if 'LeagueName' in self.dane_surowe.columns:
                self.dane_surowe['WagaMeczu'] = self.dane_surowe['LeagueName'].apply(self._daj_wage_ligi)
            else:
                self.dane_surowe['WagaMeczu'] = 1.0

                # 4. Czyscimy nazwy championow (zeby byly ladne)
            kolumny_draftu = [x['col'] for x in KOLEJNOSC_DRAFTU]
            for col in kolumny_draftu:
                if col in self.dane_surowe.columns:
                    self.dane_surowe[col] = self.dane_surowe[col].apply(lambda x: ladna_nazwa(x) if x else None)

            # 5. Przeliczamy statystyki
            self._przelicz_staty_z_wagami()
            self._laduj_role(nowy_patch)

            print(f"Zaladowano {len(self.dane_surowe)} gier.")

        except Exception as e:
            print(f"CRITICAL ERROR w przeladuj_dane: {e}")

    def _laduj_role(self, patch):
        # Pobieranie ról z tabeli pomocniczej (jesli masz)
        # Jak nie masz tabeli ChampionStats, to ten fragment mozna pominac/uproscic
        try:
            sql = f"SELECT ChampionID, PrimaryRole, Picks FROM ChampionStats WHERE PatchVersion = '{patch}'"
            df = pd.read_sql(sql, self.polaczenie_sql)

            if df.empty: return

            df['NormID'] = df['ChampionID'].apply(ladna_nazwa)

            # Mapowanie ról z bazy na nasze
            MAPA = {"TOP": "TOP", "JUNGLE": "JG", "MID": "MID", "MIDDLE": "MID", "ADC": "ADC", "BOTTOM": "ADC",
                    "BOT": "ADC", "SUPPORT": "SUP", "UTILITY": "SUP"}
            df['Rola'] = df['PrimaryRole'].astype(str).str.upper().str.strip().map(lambda x: MAPA.get(x, "MID"))

            stats = df.groupby(['NormID', 'Rola'])['Picks'].sum().reset_index()
            suma_pickow = stats.groupby('NormID')['Picks'].sum().to_dict()

            self.role_dynamiczne = {}
            for _, row in stats.iterrows():
                cid = row['NormID']
                if not cid: continue
                # Jesli postac gra na danej roli w >10% gier, to uznajemy ze to jej rola
                if (row['Picks'] / suma_pickow.get(cid, 1)) >= PROG_ROLI:
                    if cid not in self.role_dynamiczne: self.role_dynamiczne[cid] = []
                    self.role_dynamiczne[cid].append(row['Rola'])

        except Exception as e:
            print(f"Info: Nie zaladowano rol z SQL (to nie blad krytyczny): {e}")

    def _przelicz_staty_z_wagami(self):
        # Rozdzielamy na Blue i Red
        blue = self.dane_surowe[
            [c for c in self.dane_surowe.columns if 'PickBlue' in c] + ['BlueWin', 'WagaMeczu']].copy()
        blue['Win'] = blue['BlueWin']  # 1 jesli wygrali

        red = self.dane_surowe[
            [c for c in self.dane_surowe.columns if 'PickRed' in c] + ['BlueWin', 'WagaMeczu']].copy()
        red['Win'] = 1 - red['BlueWin']  # Odwracamy (0 jesli Blue wygralo)

        # Laczymy w jedna dluga liste
        wszystkie = pd.concat([
            blue.melt(id_vars=['Win', 'WagaMeczu'], value_name='ChampionID').drop('variable', axis=1),
            red.melt(id_vars=['Win', 'WagaMeczu'], value_name='ChampionID').drop('variable', axis=1)
        ])
        wszystkie = wszystkie[wszystkie['ChampionID'].notna()]

        # Kluczowy moment: WinRate wazony
        # Zwyciestwo = 1 * WagaMeczu (np. 1.0 dla LCK, 0.5 dla ERL)
        wszystkie['WartoscWygranej'] = wszystkie['Win'] * wszystkie['WagaMeczu']

        stats = wszystkie.groupby('ChampionID').agg(
            Gry=('WagaMeczu', 'sum'),  # Suma wag (ilosc "punktow" gier)
            Wygrane=('WartoscWygranej', 'sum')  # Suma wazonych zwyciestw
        ).reset_index()

        # Bayesian average zeby wygladzic wyniki dla rzadkich postac
        global_wr = stats['Wygrane'].sum() / stats['Gry'].sum() if not stats.empty else 0.5
        C = 10
        stats['WazonyWinrate'] = (stats['Wygrane'] + C * global_wr) / (stats['Gry'] + C)
        self.statystyki = stats.set_index('ChampionID')

    def daj_role(self, champ_id: str) -> List[str]:
        # Zwraca gdzie ta postac moze grac
        ladny = ladna_nazwa(champ_id)
        if ladny in self.role_dynamiczne: return self.role_dynamiczne[ladny]
        return []  # Jak nie wiemy, to pusta lista

    def co_brakuje_w_teamie(self, picki: List[Champion]) -> List[str]:
        potrzebne = ["TOP", "JG", "MID", "ADC", "SUP"]
        przypisania = []

        # Sprawdzamy co kto moze grac
        for p in picki:
            mozliwe = self.daj_role(p.id)
            przypisania.append({"id": p.id, "mozliwe": mozliwe})

        # Sortujemy - najpierw OTP (ci co maja 1 role), potem flexy
        przypisania.sort(key=lambda x: len(x['mozliwe']) if x['mozliwe'] else 999)

        pula = potrzebne.copy()
        for item in przypisania:
            if not item['mozliwe']: continue
            # Bierzemy pierwsza wolna role ktora pasuje
            pasujace = [r for r in item['mozliwe'] if r in pula]
            if pasujace:
                wybrana = pasujace[0]
                pula.remove(wybrana)
        return pula

    def oblicz_szanse_wygranej(self, stan: DraftState):
        blue_ids = [p.id for p in stan.blue_team.picks]
        red_ids = [p.id for p in stan.red_team.picks]

        if not blue_ids and not red_ids: return 50.0, 50.0

        score_b, score_r = 0, 0

        def get_wr(pid):
            name = ladna_nazwa(pid)
            if name in self.statystyki.index:
                return self.statystyki.loc[name]['WazonyWinrate']
            return 0.5

        for pid in blue_ids: score_b += get_wr(pid)
        for pid in red_ids: score_r += get_wr(pid)

        # Srednia winrate druzyny
        avg_b = score_b / max(1, len(blue_ids))
        avg_r = score_r / max(1, len(red_ids))

        suma = avg_b + avg_r
        if suma == 0: return 50.0, 50.0

        # Normalizacja do %
        p_blue = round((avg_b / suma) * 100, 1)
        p_red = round((avg_r / suma) * 100, 1)
        return p_blue, p_red

    def znajdz_podobne_mecze(self, stan: DraftState) -> List[Dict]:
        total_picks = len(stan.blue_team.picks) + len(stan.red_team.picks)
        if total_picks < 3: return []

        b_set = {ladna_nazwa(p.id) for p in stan.blue_team.picks}
        r_set = {ladna_nazwa(p.id) for p in stan.red_team.picks}

        cols_b = [c for c in self.dane_surowe.columns if 'PickBlue' in c]
        cols_r = [c for c in self.dane_surowe.columns if 'PickRed' in c]

        def licz_zgodnosc(row):
            score = 0
            for c in cols_b:
                if row[c] in b_set: score += 1
            for c in cols_r:
                if row[c] in r_set: score += 1
            return score

        # Klonujemy zeby nie psuc oryginalu
        temp_df = self.dane_surowe.copy()
        temp_df['Podobienstwo'] = temp_df.apply(licz_zgodnosc, axis=1)

        top = temp_df.sort_values('Podobienstwo', ascending=False).head(5)

        wynik = []
        for _, row in top.iterrows():
            if row['Podobienstwo'] < 2: continue

            wygra = row['Winner'] if 'Winner' in row else ("Blue" if row['BlueWin'] == 1 else "Red")
            data = str(row['Date'])[:10] if 'Date' in row else "?"

            wynik.append({
                "match_title": f"{row.get('BlueTeamID', 'Blue')} vs {row.get('RedTeamID', 'Red')}",
                "league": row.get('LeagueName', 'Pro'),
                "date": data,
                "winner": wygra,
                "similarity": int(row['Podobienstwo']),
                "patch": row.get('PatchVersion', '?')
            })
        return wynik

    def rekomenduj(self, stan: DraftState) -> List[dict]:
        # Liczymy ktora to tura draftu
        ruchow = len(stan.blue_team.bans) + len(stan.red_team.bans) + \
                 len(stan.blue_team.picks) + len(stan.red_team.picks)

        if ruchow >= len(KOLEJNOSC_DRAFTU): return []

        krok = KOLEJNOSC_DRAFTU[ruchow]
        kolumna_cel = krok['col']
        typ_ruchu = krok['type']  # PICK albo BAN

        gry = self.dane_surowe.copy()

        if kolumna_cel not in gry.columns: return []

        # --- LOGIKA WAG ---
        # Zamiast liczyc ile razy postac byla grana (count),
        # Sumujemy wagi gier. Pick w LCK (1.0) liczy sie bardziej niz w ERL (0.5)
        licznik = gry.groupby(kolumna_cel)['WagaMeczu'].sum().sort_values(ascending=False)
        suma_wag = gry['WagaMeczu'].sum()

        # Co juz jest zajete
        zajete = set()
        zajete.update([ladna_nazwa(x) for x in stan.blue_team.bans])
        zajete.update([ladna_nazwa(x) for x in stan.red_team.bans])
        zajete.update([ladna_nazwa(p.id) for p in stan.blue_team.picks])
        zajete.update([ladna_nazwa(p.id) for p in stan.red_team.picks])

        # Kto teraz wybiera
        strona = stan.current_turn_side.upper()

        moje_picki = stan.blue_team.picks if strona == "BLUE" else stan.red_team.picks
        moje_braki = self.co_brakuje_w_teamie(moje_picki)

        wrog_picki = stan.red_team.picks if strona == "BLUE" else stan.blue_team.picks
        wrog_braki = self.co_brakuje_w_teamie(wrog_picki)

        kandydaci = []

        for nazwa, wazony_count in licznik.items():
            if not nazwa: continue
            clean_id = str(nazwa)
            if clean_id in zajete: continue

            # Score to popularnosc wazona
            score = (wazony_count / suma_wag) * 100 if suma_wag > 0 else 0
            role_postaci = self.daj_role(clean_id)

            if typ_ruchu == "PICK":
                # Sprawdzamy czy pasuje do team compu
                pasuje = any(r in moje_braki for r in role_postaci)

                if not role_postaci:
                    score *= 0.5  # Jak nie znamy roli to ostroznie
                elif not pasuje and moje_braki:
                    score = 0  # Nie pickujemy drugiego ADC jak juz mamy

            if typ_ruchu == "BAN":
                # Banujemy to co boli wroga
                if role_postaci:
                    jest_grozny = any(r in wrog_braki for r in role_postaci)
                    if not jest_grozny: score *= 0.05  # Po co banowac ADC jak juz maja?

            if score > 0:
                kandydaci.append({
                    "id": clean_id,
                    "score": round(score, 1),
                    "games": int(wazony_count),
                    "role": "Any"
                })

        kandydaci.sort(key=lambda x: x['score'], reverse=True)
        return kandydaci[:15]


# --- START API ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

silnik = SilnikDraftu()


# Pomocnik do czyszczenia JSONow (np. zeby nie bylo NaN)
def czysc_json(obj):
    if isinstance(obj, dict):
        return {k: czysc_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [czysc_json(v) for v in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return 0.0 if np.isnan(obj) else float(obj)
    elif pd.isna(obj):
        return None
    return obj


@app.get("/patches")
def lista_patchy():
    return {"patches": silnik.pobierz_patche()}


@app.post("/analyze")
async def analizuj(stan: DraftState):
    try:
        # Jesli zmienil sie patch w froncie, przeladowujemy
        if stan.target_patch and stan.target_patch != silnik.aktywny_patch:
            silnik.przeladuj_dane(stan.target_patch)

        rekomendacje = silnik.rekomenduj(stan)
        win_b, win_r = silnik.oblicz_szanse_wygranej(stan)
        historia = silnik.znajdz_podobne_mecze(stan)

        odp = {
            "blue_win_probability": win_b,
            "red_win_probability": win_r,
            "recommended_picks": rekomendacje if rekomendacje else [],
            "similar_matches": historia
        }
        return czysc_json(odp)
    except Exception as e:
        print(f"Blad API: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})


@app.get("/reload")
def wymus_reload():
    silnik.przeladuj_dane(DOMYSLNY_PATCH)
    return {"status": "Przeladowano"}