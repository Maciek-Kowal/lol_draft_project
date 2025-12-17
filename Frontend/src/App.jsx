import React, { useState, useEffect, useMemo } from "react";
import axios from 'axios';
import { analyzeDraft } from "./api/draftApi";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import championRoles from "./championRoles.json"; 

// --- STYLE ---
// Zwykly reset CSS zeby ladnie wygladalo na ciemnym tle
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

// Glowny div trzymajacy calosc
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

// Inputy i przyciski
const Szukajka = styled.input` width: 100%; padding: 12px; background: #091428; border: 1px solid #444; color: white; margin-bottom: 10px; `;
const PrzyciskFiltra = styled.button` padding: 10px 20px; margin-right: 5px; border-radius: 4px; border: none; cursor: pointer; background-color: ${props => props.aktywny ? "#1e90ff" : "#444"}; color: white; font-weight: bold; `;
const BelkaFiltrow = styled.div` display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; width: 100%; `;

// Ekran Startowy (Setup)
const PudloStartowe = styled.div`
  width: 100%; max-width: 600px;
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

// Ekran Draftu
const KontenerDraftu = styled.div` width: 100%; max-width: 1600px; display: flex; flex-direction: column; gap: 20px; `;
const GornaBelka = styled.div` display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: rgba(10, 20, 40, 0.8); border: 1px solid #444; border-radius: 8px; `;
const SiatkaDraftu = styled.div` display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; `;
const KolumnaDruzyny = styled.div` width: 300px; display: flex; flex-direction: column; gap: 15px; `;
const NazwaDruzyny = styled.div` font-size: 1.5rem; font-weight: bold; text-align: center; padding: 10px; color: ${props => props.strona === "BLUE" ? "#0acbe6" : "#e84057"}; border-bottom: 3px solid ${props => props.strona === "BLUE" ? "#0acbe6" : "#e84057"}; `;

const SrodkowaKolumna = styled.div` flex: 1; display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; border: 1px solid #333; max-width: 900px; `;
const InfoTura = styled.div` font-size: 1.8rem; font-weight: bold; margin-bottom: 20px; color: ${props => props.koniec ? "#00ff00" : (props.strona === "BLUE" ? "#0acbe6" : "#e84057")}; `;

// Slot na postac (pick/ban)
const RzadSlotu = styled.div` display: flex; align-items: center; gap: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px; flex-direction: ${props => props.strona === "BLUE" ? "row" : "row-reverse"}; border-left: ${props => props.strona === "BLUE" ? "4px solid #0acbe6" : "none"}; border-right: ${props => props.strona === "RED" ? "4px solid #e84057" : "none"}; `;
const ObrazekGlowny = styled.div` width: 64px; height: 64px; border: 2px solid #444; img { width: 100%; height: 100%; object-fit: cover; } `;

// Siatka postaci do wyboru
const SiatkaPostaci = styled.div` display: flex; flex-wrap: wrap; gap: 6px; width: 100%; padding: 10px; height: 500px; overflow-y: auto; justify-content: center; `;
const PrzyciskPostaci = styled.button` width: 60px; height: 60px; border: 1px solid #444; background: #111; padding: 0; cursor: pointer; opacity: ${props => props.wylaczony ? 0.3 : 1}; img { width: 100%; height: 100%; object-fit: cover; } &:hover { transform: scale(1.1); z-index: 2; border-color: gold; } `;

// Panel Analizy (Winrate + Rekomendacje)
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

// Adres do naszego backendu w Pythonie
const API_URL = "http://localhost:8000";

// Kolejnosc draftu (standardowa turniejowa)
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

// Pomocnicza funkcja zeby naprawic nazwy z backendu (np. Wukong vs MonkeyKing)
const naprawNazwePostaci = (idZBackendu) => {
    if (!idZBackendu) return null;
    const cleanId = String(idZBackendu).toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // Szukamy w naszym pliku JSON
    const keys = Object.keys(championRoles);
    for (const k of keys) {
        const cleanJson = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanJson === cleanId) return k;
        // Fixy na dziwne nazwy Riotu
        if (cleanId === "monkeyking" && cleanJson === "wukong") return k;
        if (cleanId === "wukong" && cleanJson === "monkeyking") return k;
        if (cleanId === "renataglasc" && cleanJson === "renata") return k;
    }
    return idZBackendu;
};

// --- GLOWNY KOMPONENT ---
function App() {
  // Stan aplikacji
  const [faza, ustawFaze] = useState("SETUP"); // SETUP albo DRAFT
  const [konfig, ustawKonfig] = useState({ 
      tryb: "PvAI", 
      stronaGracza: "BLUE", 
      patch: "PRO-S15"
  });
  
  const [dostepnePatche, ustawPatche] = useState(["PRO-S15"]);
  
  // Stan draftu - to co wysylamy do Pythona
  const [stanDraftu, ustawStanDraftu] = useState({ 
      blue_team: { picks: [], bans: [] }, 
      red_team: { picks: [], bans: [] } 
  });
  
  const [numerTury, ustawNumerTury] = useState(0);
  const [wynikAnalizy, ustawWynikAnalizy] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(false);
  
  // Filtrowanie postaci
  const [szukanaNazwa, ustawSzukanaNazwe] = useState("");
  const [szukanaRola, ustawSzukanaRole] = useState("");

  const czyKoniecDraftu = numerTury >= SEKWENCJA_DRAFTU.length;
  const obecnaTura = !czyKoniecDraftu ? SEKWENCJA_DRAFTU[numerTury] : null;

  // Na start pobieramy patche z backendu
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

  const rozpocznijDraft = () => {
    ustawFaze("DRAFT");
    ustawStanDraftu({ blue_team: { picks: [], bans: [] }, red_team: { picks: [], bans: [] } });
    ustawNumerTury(0);
    ustawWynikAnalizy(null);
  };

  // Glowna petla logiczna - sprawdza czyja tura i pyta AI
  useEffect(() => {
    if (faza !== "DRAFT") return;
    
    // Jak koniec to robimy finalna analize
    if (czyKoniecDraftu) {
        if (!wynikAnalizy) zapytajAI(true);
        return;
    }

    // Sprawdzamy czy teraz rusza sie AI czy Gracz
    let czyRuchAI = (konfig.tryb === "AIvAI") || (obecnaTura.side !== konfig.stronaGracza);
    
    if (czyRuchAI && !ladowanie) {
        zapytajAI(false); // AI gra samo
    } else if (!czyRuchAI && !ladowanie && !wynikAnalizy) {
        zapytajAI(false, true); // Tylko podpowiedz dla gracza
    }
  }, [numerTury, faza, czyKoniecDraftu]); 

  // Funkcja gadajaca z Pythonem
  const zapytajAI = async (czyFinal, czyTylkoPodpowiedz = false) => {
      ustawLadowanie(true);
      try {
          // Male opoznienie zeby wygladalo ze mysli
          if (!czyFinal && !czyTylkoPodpowiedz) await new Promise(r => setTimeout(r, 800));
          
          const payload = {
            blue_team: stanDraftu.blue_team, 
            red_team: stanDraftu.red_team,
            current_turn_side: czyFinal ? "NONE" : obecnaTura.side,
            target_patch: konfig.patch,
            // Puste listy bo na razie nie robimy exkluzji
            blue_exclusions: [], 
            red_exclusions: []
          };
          
          const res = await analyzeDraft(payload);
          ustawWynikAnalizy(res);
          
          // Jesli to ruch AI, to automatycznie wybieramy to co polecil
          if (!czyFinal && !czyTylkoPodpowiedz) {
              const najlepszyWybor = res.recommended_picks?.[0];
              if (najlepszyWybor) {
                 const klucz = naprawNazwePostaci(najlepszyWybor.id);
                 const danePostaci = championRoles[klucz];
                 if (danePostaci) wybierzPostac(danePostaci);
              }
          }
      } catch (error) { 
          console.error("Blad AI:", error); 
      } finally { 
          ustawLadowanie(false); 
      }
  };

  // Klikniecie w postac
  const wybierzPostac = (champ) => {
    if (!obecnaTura) return;
    
    const { type, side } = obecnaTura;
    
    ustawStanDraftu(stare => {
      const nowe = JSON.parse(JSON.stringify(stare));
      const team = side === "BLUE" ? "blue_team" : "red_team";
      const pickObj = { id: champ.id, name: champ.name, lane: champ.lane || "Any" };
      
      if (type === "BAN") {
        // Nie banujemy 2 razy tego samego
        if (!nowe[team].bans.includes(champ.id)) nowe[team].bans.push(champ.id);
      } else { 
        nowe[team].picks.push(pickObj); 
      }
      return nowe;
    });

    ustawWynikAnalizy(null); 
    ustawNumerTury(prev => prev + 1);
    ustawSzukanaNazwe(""); // Reset szukania po wyborze
  };

  // Lista postaci do renderowania (z filtrowaniem)
  const listaPostaci = useMemo(() => {
      return Object.values(championRoles).filter(c => {
          if (szukanaRola && c.lane !== szukanaRola) return false;
          return c.name.toLowerCase().includes(szukanaNazwa.toLowerCase());
      });
  }, [szukanaNazwa, szukanaRola]);

  // Sprawdza czy postac juz zajeta
  const czyZajeta = (id) => {
      const all = [
          ...stanDraftu.blue_team.bans, 
          ...stanDraftu.red_team.bans, 
          ...stanDraftu.blue_team.picks.map(p=>p.id), 
          ...stanDraftu.red_team.picks.map(p=>p.id)
      ];
      return all.includes(id);
  };

  // Renderowanie slotow (koleczka z postaciami)
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
              {/* Puste sloty na bany */}
              {Array.from({ length: 5 - bans.length }).map((_, i) => <div key={i} style={{width: 32, height: 32, border: "1px dashed #333"}}></div>)}
          </div>
      )
  }

  // --- HTML (JSX) ---
  return (
    <>
      <GlobalStyle />
      <GlownyKontener czySetup={faza === "SETUP"}>
        
        {faza === "SETUP" ? (
          // EKRAN STARTOWY
          <PudloStartowe>
              <Tytul>LoL Pro Draft</Tytul>
              
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

              {konfig.tryb === "PvAI" && (
                  <GrupaFormularza>
                      <Etykieta>Twoja Strona</Etykieta>
                      <WyborSelect value={konfig.stronaGracza} onChange={e => ustawKonfig({...konfig, stronaGracza: e.target.value})}>
                          <option value="BLUE">Niebieska (Blue Side)</option>
                          <option value="RED">Czerwona (Red Side)</option>
                      </WyborSelect>
                  </GrupaFormularza>
              )}

              <PrzyciskStart onClick={rozpocznijDraft}>START</PrzyciskStart>
          </PudloStartowe>

        ) : (
          // EKRAN DRAFTU
          <KontenerDraftu>
              <GornaBelka>
                  <h2 style={{margin:0, color: "#c8aa6e"}}>DRAFT {konfig.patch}</h2>
                  <PrzyciskFiltra onClick={() => ustawFaze("SETUP")}>Zakończ</PrzyciskFiltra>
              </GornaBelka>

              <SiatkaDraftu>
                  {/* LEWA STRONA (BLUE) */}
                  <KolumnaDruzyny>
                      <NazwaDruzyny strona="BLUE">Niebiescy</NazwaDruzyny>
                      {renderPanelPicks("blue_team")}
                      {renderPanelBans("blue_team")}
                  </KolumnaDruzyny>

                  {/* SRODEK (INFO + WYBOR) */}
                  <SrodkowaKolumna>
                      <InfoTura strona={obecnaTura?.side} koniec={czyKoniecDraftu}>
                          {czyKoniecDraftu ? "KONIEC DRAFTU" : `Tura: ${obecnaTura?.side} ${obecnaTura?.type}`}
                      </InfoTura>

                      {!czyKoniecDraftu && (
                          <>
                            <BelkaFiltrow>
                                <Szukajka placeholder="Szukaj postaci..." onChange={e => ustawSzukanaNazwe(e.target.value)} value={szukanaNazwa} style={{width: 200}} />
                                {["", "TOP", "JG", "MID", "ADC", "SUP"].map(rola => (
                                    <PrzyciskFiltra 
                                        key={rola}
                                        aktywny={szukanaRola === rola} 
                                        onClick={() => ustawSzukanaRole(rola)}
                                    >
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

                      {/* WYNIKI ANALIZY OD AI */}
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
                              
                              {/* Rekomendacja (Wyswietla tylko jesli draft trwa i jest ruch gracza) */}
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

                  {/* PRAWA STRONA (RED) */}
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