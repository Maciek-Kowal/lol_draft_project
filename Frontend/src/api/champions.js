export async function getChampionList() {
    try {
        // Pobieramy najnowszą wersję LoLa
        const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json());
        const latest = versions[0];

        // Pobieramy listę championów
        const champs = await fetch(
            `https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`
        ).then(r => r.json());

        const result = Object.values(champs.data).map(ch => ({
            id: ch.id,
            name: ch.name,
            icon: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${ch.image.full}`
        }));

        return result;
    } catch (e) {
        console.error("Champion fetch failed:", e);
        return [];
    }
}
