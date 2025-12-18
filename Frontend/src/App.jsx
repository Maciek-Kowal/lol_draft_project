import React, { useState, useEffect, useMemo } from "react";
import axios from 'axios';
import { analyzeDraft } from "./api/draftApi";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import championRoles from "./championRoles.json"; 

// --- STYLE ---
const GlobalStyle = createGlobalStyle`
  body, html {
    margin: 0; padding: 0; height: 100%; width: 100%;
    background-color: #010a13;
    font-family: 'Segoe UI', sans-serif;
    color: #f0f0f0;
  }
  #root { height: 100%; width: 100%; display: flex; flex-direction: column; }
  * { box-sizing: border-box; }
`;

const animacjaWjazdu = keyframes` from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } `;

const GlownyKontener = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: ${props => props.czySetup ? "center" : "flex-start"};
  background: radial-gradient(circle at center, #091428 0%, #010a13 100%);
  padding: 20px;
`;

const Szukajka = styled.input` width: 100%; padding: 12px; background: #091428; border: 1px solid #444; color: white; margin-bottom: 10px; `;
const PrzyciskFiltra = styled.button` padding: 10px 20px; margin-right: 5px; border-radius: 4px; border: none; cursor: pointer; background-color: ${props => props.aktywny ? "#1e90ff" : "#444"}; color: white; font-weight: bold; `;
const BelkaFiltrow = styled.div` display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; width: 100%; `;

// Ekran Startowy
const PudloStartowe = styled.div`
  width: 100%; max-width: 800px; 
  background: rgba(10, 20, 40, 0.95);
  border: 2px solid #c8aa6e;
  border-radius: 8px;
  padding: 40px;
  animation: ${animacjaWjazdu} 0.5s ease-out;
  display: flex; flex-direction: column; gap: 20px;
`;

const Tytul = styled.h1` text-align: center; color: #f0e6d2; margin-bottom: 30px; border-bottom: 1px solid #444; padding-bottom: 20px; `;
const GrupaFormularza = styled.div` display: flex; flex-direction: column; gap: 8px; `;
const Etykieta = styled.label` color: #c8aa6e; font-weight: bold; `;
const WyborSelect = styled.select` padding: 12px; background: #010a13; color: #f0e6d2; border: 1px solid #5c5b57; cursor: pointer; `;
const PrzyciskStart = styled.button`
  padding: 18px; font-size: 1.2rem; font-weight: bold;
  background: #1e2328; color: #c8aa6e; border: 2px solid #c8aa6e; 
  cursor: pointer; margin-top: 15px; width: 100%;
  &:hover { background: #c8aa6e; color: #010a13; }
`;

// NOWE KOMPONENTY DO WYKLUCZEŃ (ZAKŁADKI)
const PanelWykluczen = styled.div` border: 1px solid #444; background: #050b14; padding: 15px; margin-top: 5px; border-radius: 4px; `;
const KontenerZakladek = styled.div` display: flex; gap: 10px; margin-bottom: 10px; `;
const PrzyciskZakladki = styled.button`
  flex: 1; padding: 10px; border: 1px solid #444; cursor: pointer; font-weight: bold; text-transform: uppercase;
  background: ${props => props.aktywny ? (props.strona === "BLUE" ? "rgba(10, 203, 230, 0.2)" : "rgba(232, 64, 87, 0.2)") : "transparent"};
  color: ${props => props.aktywny ? (props.strona === "BLUE" ? "#0acbe6" : "#e84057") : "#888"};
  border-color: ${props => props.aktywny ? (props.strona === "BLUE" ? "#0acbe6" : "#e84057") : "#444"};
  &:hover { color: white; border-color: #666; }
`;

const SiatkaWykluczen = styled.div` display: flex; flex-wrap: wrap; gap: 4px; max-height: 200px; overflow-y: auto; margin-bottom: 10px; `;
const SlotWykluczen = styled.div` 
  width: 40px; height: 40px; border: 1px solid #333; cursor: pointer; position: relative;
  opacity: ${props => props.aktywny ? 1 : 0.4}; 
  border-color: ${props => props.aktywny ? (props.strona === "BLUE" ? "#0acbe6" : "#e84057") : "#333"};
  img { width: 100%; height: 100%; object-fit: cover; }
  &:hover { opacity: 1; border-color: gold; }
  ${props => props.aktywny && `&::after { content: "✖"; position: absolute; color: white; font-weight: bold; top: 0; right: 0; background: ${props.strona === "BLUE" ? "#0acbe6" : "#e84057"}; font-size: 10px; padding: 1px; }`}
`;
const PoleTekstoweWykluczen = styled.textarea`
  width: 100%; height: 80px; background: #091428; border: 1px solid #555; color: #aaa; padding: 10px; font-family: monospace; font-size: 0.85rem; resize: vertical;
  &:focus { border-color: #c8aa6e; outline: none; color: white; }
`;

// Ekran Draftu
const KontenerDraftu = styled.div` width: 100%; max-width: 1600px; display: flex; flex-direction: column; gap: 20px; `;
const GornaBelka = styled.div` display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: rgba(10, 20, 40, 0.8); border: 1px solid #444; border-radius: 8px; `;
const SiatkaDraftu = styled.div` display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; `;
const KolumnaDruzyny = styled.div` width: 300px; display: flex; flex-direction: column; gap: 15px; `;
const NazwaDruzyny = styled.div` font-size: 1.5rem; font-weight: bold; text-align: center; padding: 10px; color: ${props => props.strona === "BLUE" ? "#0acbe6" : "#e84057"}; border-bottom: 3px solid ${props => props.strona === "BLUE" ? "#0acbe6" : "#e84057"}; `;

const SrodkowaKolumna = styled.div` flex: 1; display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; border: 1px solid #333; max-width: 900px; `;
const InfoTura = styled.div` font-size: 1.8rem; font-weight: bold; margin-bottom: 20px; color: ${props => props.koniec ? "#00ff00" : (props.strona === "BLUE" ? "#0acbe6" : "#e84057")}; `;

const RzadSlotu = styled.div` display: flex; align-items: center; gap: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px; flex-direction: ${props => props.strona === "BLUE" ? "row" : "row-reverse"}; border-left: ${props => props.strona === "BLUE" ? "4px solid #0acbe6" : "none"}; border-right: ${props => props.strona === "RED" ? "4px solid #e84057" : "none"}; `;
const ObrazekGlowny = styled.div` width: 64px; height: 64px; border: 2px solid #444; img { width: 100%; height: 100%; object-fit: cover; } `;

const SiatkaPostaci = styled.div` display: flex; flex-wrap: wrap; gap: 6px; width: 100%; padding: 10px; height: 500px; overflow-y: auto; justify-content: center; `;
const PrzyciskPostaci = styled.button` width: 60px; height: 60px; border: 1px solid #444; background: #111; padding: 0; cursor: pointer; opacity: ${props => props.wylaczony ? 0.3 : 1}; img { width: 100%; height: 100%; object-fit: cover; } &:hover { transform: scale(1.1); z-index: 2; border-color: gold; } `;

const PanelAnalizy = styled.div` margin-top: 20px; background: rgba(10,20,30,0.9); padding: 20px; border: 1px solid #333; width: 100%; border-radius: 8px; text-align: center; `;
const PasekWinrate = styled.div` display: flex; height: 10px; width: 100%; background: #333; margin: 15px 0; border-radius: 5px; overflow: hidden; `;
const SegmentPaska = styled.div` height: 100%; background: ${props => props.kolor}; width: ${props => props.procent}%; `;

const PrzyciskRekomendacji = styled.button`
  background: #333; border: 1px solid #555; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
  &:hover { border-color: gold; background: #444; }
  img { width: 40px; height: 40px; }
  b { color: gold; font-size: 1.2rem; display: block; }
  span { color: #aaa; font-size: 0.8rem; }
`;

// --- LOGIKA ---
const API_URL = "http://localhost:8000";

const SEKWENCJA_DRAFTU = [
  { type: "BAN", side: "BLUE" }, { type: "BAN", side: "RED" },
  { type: "BAN", side: "BLUE" }, { type: "BAN", side: "RED" },
  { type: "BAN", side: "BLUE" }, { type: "BAN", side: "RED" },
  { type: "PICK", side: "BLUE" }, { type: "PICK", side: "RED" },
  { type: "PICK", side: "RED" }, { type: "PICK", side: "BLUE" },
  { type: "PICK", side: "BLUE" }, { type: "PICK", side: "RED" },
  { type: "BAN", side: "RED" }, { type: "BAN", side: "BLUE" },
  { type: "BAN", side: "RED" }, { type: "BAN", side: "BLUE" },
  { type: "PICK", side: "RED" }, { type: "PICK", side: "BLUE" },
  { type: "PICK", side: "BLUE" }, { type: "PICK", side: "RED" },
];

const naprawNazwePostaci = (idZBackendu) => {
    if (!idZBackendu) return null;
    const cleanId = String(idZBackendu).toLowerCase().replace(/[^a-z0-9]/g, "");
    const keys = Object.keys(championRoles);
    for (const k of keys) {
        const cleanJson = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanJson === cleanId) return k;
        if (cleanId === "monkeyking" && cleanJson === "wukong") return k;
        if (cleanId === "wukong" && cleanJson === "monkeyking") return k;
        if (cleanId === "renataglasc" && cleanJson === "renata") return k;
    }
    return idZBackendu;
};

function App() {
  const [faza, ustawFaze] = useState("SETUP");
  const [konfig, ustawKonfig] = useState({ 
      tryb: "PvAI", 
      stronaGracza: "BLUE", 
      patch: "PRO-S15"
  });
  
  // NOWE: Dwa osobne stany dla wykluczen
  const [zakladka, ustawZakladke] = useState("BLUE"); // Ktora zakladka aktywna
  const [wykluczeniaBlue, ustawWykluczeniaBlue] = useState([]);
  const [wykluczeniaRed, ustawWykluczeniaRed] = useState([]);
  
  const [tekstBlue, ustawTekstBlue] = useState("");
  const [tekstRed, ustawTekstRed] = useState("");

  const [dostepnePatche, ustawPatche] = useState(["PRO-S15"]);
  const [stanDraftu, ustawStanDraftu] = useState({ blue_team: { picks: [], bans: [] }, red_team: { picks: [], bans: [] } });
  const [numerTury, ustawNumerTury] = useState(0);
  const [wynikAnalizy, ustawWynikAnalizy] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [szukanaNazwa, ustawSzukanaNazwe] = useState("");
  const [szukanaRola, ustawSzukanaRole] = useState("");

  const czyKoniecDraftu = numerTury >= SEKWENCJA_DRAFTU.length;
  const obecnaTura = !czyKoniecDraftu ? SEKWENCJA_DRAFTU[numerTury] : null;

  useEffect(() => {
      axios.get(`${API_URL}/patches`)
        .then(res => {
            if (res.data.patches && res.data.patches.length > 0) {
                ustawPatche(res.data.patches);
                ustawKonfig(prev => ({...prev, patch: res.data.patches[0]}));
            }
        })
        .catch(err => console.log("Backend nie odpowiada:", err));
  }, []);

  // --- LOGIKA WYKLUCZEŃ ---
  const przelaczWykluczenie = (champId) => {
    // Sprawdzamy na ktorej jestesmy zakladce
    const lista = zakladka === "BLUE" ? wykluczeniaBlue : wykluczeniaRed;
    const ustawListe = zakladka === "BLUE" ? ustawWykluczeniaBlue : ustawWykluczeniaRed;
    const ustawTekst = zakladka === "BLUE" ? ustawTekstBlue : ustawTekstRed;

    let nowaLista;
    if (lista.includes(champId)) {
        nowaLista = lista.filter(id => id !== champId);
    } else {
        nowaLista = [...lista, champId];
    }
    
    ustawListe(nowaLista);
    
    // Generujemy tekst
    const nazwy = nowaLista.map(id => {
        const k = naprawNazwePostaci(id);
        return championRoles[k]?.name || id;
    });
    ustawTekst(nazwy.join(", "));
  };

  const obsluzZmianeTekstu = (e) => {
      const tekst = e.target.value;
      const ustawTekst = zakladka === "BLUE" ? ustawTekstBlue : ustawTekstRed;
      const ustawListe = zakladka === "BLUE" ? ustawWykluczeniaBlue : ustawWykluczeniaRed;

      ustawTekst(tekst);

      // Parsowanie tekstu na ID
      const nazwy = tekst.split(",").map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
      const noweIdki = [];
      const wszystkiePostacie = Object.values(championRoles);
      
      nazwy.forEach(n => {
          const znaleziona = wszystkiePostacie.find(c => c.name.toLowerCase() === n || c.id.toLowerCase() === n);
          if (znaleziona) noweIdki.push(znaleziona.id);
      });
      ustawListe(noweIdki);
  };

  const rozpocznijDraft = () => {
    ustawFaze("DRAFT");
    ustawStanDraftu({ blue_team: { picks: [], bans: [] }, red_team: { picks: [], bans: [] } });
    ustawNumerTury(0);
    ustawWynikAnalizy(null);
  };

  useEffect(() => {
    if (faza !== "DRAFT") return;
    if (czyKoniecDraftu) {
        if (!wynikAnalizy) zapytajAI(true);
        return;
    }
    let czyRuchAI = (konfig.tryb === "AIvAI") || (obecnaTura.side !== konfig.stronaGracza);
    if (czyRuchAI && !ladowanie) {
        zapytajAI(false);
    } else if (!czyRuchAI && !ladowanie && !wynikAnalizy) {
        zapytajAI(false, true);
    }
  }, [numerTury, faza, czyKoniecDraftu]); 

  const zapytajAI = async (czyFinal, czyTylkoPodpowiedz = false) => {
      ustawLadowanie(true);
      try {
          if (!czyFinal && !czyTylkoPodpowiedz) await new Promise(r => setTimeout(r, 800));
          
          const payload = {
            blue_team: stanDraftu.blue_team, 
            red_team: stanDraftu.red_team,
            current_turn_side: czyFinal ? "NONE" : obecnaTura.side,
            target_patch: konfig.patch,
            // Teraz wysylamy DWA osobne zestawy wykluczen
            blue_exclusions: wykluczeniaBlue,
            red_exclusions: wykluczeniaRed
          };
          
          const res = await analyzeDraft(payload);
          ustawWynikAnalizy(res);
          
          if (!czyFinal && !czyTylkoPodpowiedz) {
              const najlepszyWybor = res.recommended_picks?.[0];
              if (najlepszyWybor) {
                 const klucz = naprawNazwePostaci(najlepszyWybor.id);
                 const danePostaci = championRoles[klucz];
                 if (danePostaci) wybierzPostac(danePostaci);
              }
          }
      } catch (error) { console.error("Blad AI:", error); } finally { ustawLadowanie(false); }
  };

  const wybierzPostac = (champ) => {
    if (!obecnaTura) return;
    const { type, side } = obecnaTura;
    
    ustawStanDraftu(stare => {
      const nowe = JSON.parse(JSON.stringify(stare));
      const team = side === "BLUE" ? "blue_team" : "red_team";
      const pickObj = { id: champ.id, name: champ.name, lane: champ.lane || "Any" };
      if (type === "BAN") {
        if (!nowe[team].bans.includes(champ.id)) nowe[team].bans.push(champ.id);
      } else { 
        nowe[team].picks.push(pickObj); 
      }
      return nowe;
    });
    ustawWynikAnalizy(null); 
    ustawNumerTury(prev => prev + 1);
    ustawSzukanaNazwe("");
  };

  const listaPostaci = useMemo(() => {
      return Object.values(championRoles).filter(c => {
          if (szukanaRola && c.lane !== szukanaRola) return false;
          return c.name.toLowerCase().includes(szukanaNazwa.toLowerCase());
      });
  }, [szukanaNazwa, szukanaRola]);

  const listaPostaciDoWykluczen = useMemo(() => {
      return Object.values(championRoles).sort((a,b) => a.name.localeCompare(b.name));
  }, []);

  const czyZajeta = (id) => {
      // Przy drafcie bierzemy pod uwage wykluczenia odpowiedniej druzyny (zaleznie kto wybiera)
      // Ale dla uproszczenia widoku blokujemy wszystkie "uzyte" postacie
      const all = [
          ...stanDraftu.blue_team.bans, 
          ...stanDraftu.red_team.bans, 
          ...stanDraftu.blue_team.picks.map(p=>p.id), 
          ...stanDraftu.red_team.picks.map(p=>p.id),
          // Tutaj mozna dodac wykluczenia jesli chcemy zeby nie dalo sie ich kliknac
          // ale w praktyce w drafcie wykluczenia dzialaja "po cichu" na logike AI
      ];
      return all.includes(id);
  };

  const renderPanelPicks = (druzyna) => {
      const picks = stanDraftu[druzyna].picks;
      const strona = druzyna === "blue_team" ? "BLUE" : "RED";
      return (
          <>
            {Array.from({ length: 5 }).map((_, idx) => {
                const pickData = picks[idx] || null;
                const klucz = pickData ? naprawNazwePostaci(pickData.id) : null;
                const info = klucz ? championRoles[klucz] : null;
                return (
                    <RzadSlotu key={idx} strona={strona}>
                        <ObrazekGlowny style={{borderColor: strona === "BLUE" ? "#0acbe6" : "#e84057"}}>
                            {info ? <img src={info.icon} alt="" /> : null}
                        </ObrazekGlowny>
                    </RzadSlotu>
                )
            })}
          </>
      )
  };

  const renderPanelBans = (druzyna) => {
      const bans = stanDraftu[druzyna].bans;
      return (
          <div style={{display: "flex", gap: 5, justifyContent: druzyna === "blue_team" ? "flex-end" : "flex-start"}}>
              {bans.map((id, idx) => {
                  const klucz = naprawNazwePostaci(id);
                  const info = championRoles[klucz];
                  return <div key={idx} style={{width: 32, height: 32, border: "1px solid #555"}}>{info && <img src={info.icon} style={{width:"100%"}} alt="" />}</div>
              })}
              {Array.from({ length: 5 - bans.length }).map((_, i) => <div key={i} style={{width: 32, height: 32, border: "1px dashed #333"}}></div>)}
          </div>
      )
  }

  return (
    <>
      <GlobalStyle />
      <GlownyKontener czySetup={faza === "SETUP"}>
        
        {faza === "SETUP" ? (
          <PudloStartowe>
              <Tytul>LoL Pro Draft</Tytul>
              
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20}}>
                <GrupaFormularza>
                    <Etykieta>Wybierz Patch</Etykieta>
                    <WyborSelect value={konfig.patch} onChange={e => ustawKonfig({...konfig, patch: e.target.value})}>
                        {dostepnePatche.map(p => <option key={p} value={p}>{p}</option>)}
                    </WyborSelect>
                </GrupaFormularza>

                <GrupaFormularza>
                    <Etykieta>Tryb Gry</Etykieta>
                    <WyborSelect value={konfig.tryb} onChange={e => ustawKonfig({...konfig, tryb: e.target.value})}>
                        <option value="PvAI">Człowiek vs AI</option>
                        <option value="AIvAI">Symulacja (AI vs AI)</option>
                    </WyborSelect>
                </GrupaFormularza>
              </div>

              {konfig.tryb === "PvAI" && (
                  <GrupaFormularza>
                      <Etykieta>Twoja Strona</Etykieta>
                      <WyborSelect value={konfig.stronaGracza} onChange={e => ustawKonfig({...konfig, stronaGracza: e.target.value})}>
                          <option value="BLUE">Niebieska (Blue Side)</option>
                          <option value="RED">Czerwona (Red Side)</option>
                      </WyborSelect>
                  </GrupaFormularza>
              )}

              {/* --- ZMODYFIKOWANA SEKCJA WYKLUCZEŃ --- */}
              <GrupaFormularza>
                  <Etykieta>Zablokowane postacie (Player Pools)</Etykieta>
                  
                  {/* ZAKLADKI */}
                  <KontenerZakladek>
                      <PrzyciskZakladki aktywny={zakladka === "BLUE"} strona="BLUE" onClick={() => ustawZakladke("BLUE")}>
                          Dla Blue Team
                      </PrzyciskZakladki>
                      <PrzyciskZakladki aktywny={zakladka === "RED"} strona="RED" onClick={() => ustawZakladke("RED")}>
                          Dla Red Team
                      </PrzyciskZakladki>
                  </KontenerZakladek>

                  <PanelWykluczen>
                      <Szukajka placeholder="Filtruj listę ikon..." onChange={e => ustawSzukanaNazwe(e.target.value)} value={szukanaNazwa} style={{marginBottom: 5, padding: 8}}/>
                      
                      <SiatkaWykluczen>
                          {listaPostaciDoWykluczen
                              .filter(c => c.name.toLowerCase().includes(szukanaNazwa.toLowerCase()))
                              .map(c => {
                                  // Sprawdzamy czy aktywny na OBECNEJ zakladce
                                  const aktywnaLista = zakladka === "BLUE" ? wykluczeniaBlue : wykluczeniaRed;
                                  const czyZablokowany = aktywnaLista.includes(c.id);

                                  return (
                                      <SlotWykluczen 
                                          key={c.id} 
                                          aktywny={czyZablokowany}
                                          strona={zakladka}
                                          onClick={() => przelaczWykluczenie(c.id)}
                                          title={c.name}
                                      >
                                          <img src={c.icon} alt={c.name} />
                                      </SlotWykluczen>
                                  )
                          })}
                      </SiatkaWykluczen>

                      <Etykieta style={{fontSize: "0.8rem", color: "#888"}}>
                          Lista tekstowa dla {zakladka} (kopiuj/wklej):
                      </Etykieta>
                      <PoleTekstoweWykluczen 
                          value={zakladka === "BLUE" ? tekstBlue : tekstRed}
                          onChange={obsluzZmianeTekstu}
                          placeholder="Np. Aatrox, Ahri, Zed..."
                      />
                  </PanelWykluczen>
              </GrupaFormularza>

              <PrzyciskStart onClick={rozpocznijDraft}>START</PrzyciskStart>
          </PudloStartowe>

        ) : (
          <KontenerDraftu>
              <GornaBelka>
                  <h2 style={{margin:0, color: "#c8aa6e"}}>DRAFT {konfig.patch}</h2>
                  <PrzyciskFiltra onClick={() => ustawFaze("SETUP")}>Zakończ</PrzyciskFiltra>
              </GornaBelka>

              <SiatkaDraftu>
                  <KolumnaDruzyny>
                      <NazwaDruzyny strona="BLUE">Niebiescy</NazwaDruzyny>
                      {renderPanelPicks("blue_team")}
                      {renderPanelBans("blue_team")}
                  </KolumnaDruzyny>

                  <SrodkowaKolumna>
                      <InfoTura strona={obecnaTura?.side} koniec={czyKoniecDraftu}>
                          {czyKoniecDraftu ? "KONIEC DRAFTU" : `Tura: ${obecnaTura?.side} ${obecnaTura?.type}`}
                      </InfoTura>

                      {!czyKoniecDraftu && (
                          <>
                            <BelkaFiltrow>
                                <Szukajka placeholder="Szukaj postaci..." onChange={e => ustawSzukanaNazwe(e.target.value)} value={szukanaNazwa} style={{width: 200}} />
                                {["", "TOP", "JG", "MID", "ADC", "SUP"].map(rola => (
                                    <PrzyciskFiltra key={rola} aktywny={szukanaRola === rola} onClick={() => ustawSzukanaRole(rola)}>
                                        {rola || "ALL"}
                                    </PrzyciskFiltra>
                                ))}
                            </BelkaFiltrow>

                            <SiatkaPostaci>
                                {listaPostaci.map(c => (
                                    <PrzyciskPostaci key={c.id}
                                        wylaczony={czyZajeta(c.id) || ladowanie || (konfig.tryb === "PvAI" && obecnaTura?.side !== konfig.stronaGracza)}
                                        onClick={() => wybierzPostac(c)}
                                    >
                                        <img src={c.icon} alt={c.name} />
                                    </PrzyciskPostaci>
                                ))}
                            </SiatkaPostaci>
                          </>
                      )}

                      {wynikAnalizy && (
                          <PanelAnalizy>
                              <div style={{fontSize: "1.2rem", fontWeight: "bold", marginBottom: 5}}>
                                  <span style={{color: "#0acbe6"}}>{wynikAnalizy.blue_win_probability}%</span> 
                                  <span style={{color: "#666", margin: "0 10px"}}>VS</span>
                                  <span style={{color: "#e84057"}}>{wynikAnalizy.red_win_probability}%</span>
                              </div>
                              <PasekWinrate>
                                  <SegmentPaska kolor="#0acbe6" procent={wynikAnalizy.blue_win_probability} />
                                  <SegmentPaska kolor="#e84057" procent={wynikAnalizy.red_win_probability} />
                              </PasekWinrate>
                              
                              {!czyKoniecDraftu && wynikAnalizy.recommended_picks?.[0] && (() => {
                                  const rec = wynikAnalizy.recommended_picks[0];
                                  const klucz = naprawNazwePostaci(rec.id);
                                  const dane = championRoles[klucz];
                                  if(!dane) return null;

                                  return (
                                      <div style={{marginTop: 15, display: "flex", justifyContent: "center"}}>
                                          <PrzyciskRekomendacji onClick={() => {
                                              if(!czyZajeta(dane.id) && konfig.tryb === "PvAI" && obecnaTura.side === konfig.stronaGracza) {
                                                  wybierzPostac(dane);
                                              }
                                          }}>
                                              <img src={dane.icon} alt="" />
                                              <div>
                                                  <b>AI Poleca: {dane.name}</b>
                                                  <span>Siła wyboru: {rec.score}</span>
                                              </div>
                                          </PrzyciskRekomendacji>
                                      </div>
                                  )
                              })()}
                          </PanelAnalizy>
                      )}
                  </SrodkowaKolumna>

                  <KolumnaDruzyny>
                      <NazwaDruzyny strona="RED">Czerwoni</NazwaDruzyny>
                      {renderPanelPicks("red_team")}
                      {renderPanelBans("red_team")}
                  </KolumnaDruzyny>
              </SiatkaDraftu>
          </KontenerDraftu>
        )}
      </GlownyKontener>
    </>
  );
}

export default App;