---
layout: null
---
document.addEventListener("DOMContentLoaded", function() {
    initProgramGrid();
    initModalLogic();
});

// Liste ordonnée des salles déduite des datas pour avoir un ordre fixe de colonnes
let rooms = [];
// Index pour regrouper les sessions du même créneau
let slotsGroups = {};
const FULL_WIDTH_FORMATS = ['Pause', 'Plénière', 'Keynote'];

// Une session est rangée dans la colonne de sa track ; à défaut, dans celle de sa salle
function columnKey(session) {
    return /^Track\s*\d+$/i.test(session.sessionTrack || '') ? session.sessionTrack.trim() : session.location;
}

// Photo : adresse web complète (https://...) ou nom de fichier dans assets/images/orators/
function photoUrl(image) {
    return /^https?:\/\//.test(image) ? image : `{{ 'assets/images/orators/' | relative_url }}${image}`;
}

function calculateTimeLabel(slotNumber, span = 1, showEnd = false) {
    const startSlot = parseInt(slotNumber);
    const endSlot = startSlot + parseInt(span);
    
    if (creneauxData[startSlot]) {
        let debut = creneauxData[startSlot].debut;
        if (!showEnd) return debut;
        
        let fin = creneauxData[endSlot] ? creneauxData[endSlot].debut : EVENT_END_TIME_STR;
        return `${debut}-${fin}`;
    }
    return showEnd ? `--:-- - --:--` : `--:--`;
}

function initProgramGrid() {
    const grid = document.getElementById("program-grid-container");
    if(!grid) return;

    // Colonnes = tracks (Track 1, Track 2...) plutôt que salles :
    // les salles changent entre matin et après-midi, les tracks restent alignées.
    const colSet = new Set();
    programData.forEach(s => {
        if (!FULL_WIDTH_FORMATS.includes(s.slotFormat)) colSet.add(columnKey(s));
    });
    rooms = Array.from(colSet).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

    // Grille fluide : 120 sous-colonnes. À chaque créneau, les sessions se partagent
    // toute la largeur libre, pour qu'il n'y ait jamais de colonne vide.
    const U = 120;
    grid.classList.add("is-fluid");
    grid.style.gridTemplateColumns = `120px repeat(${U}, minmax(0, 1fr))`;

    // Regrouper les slots
    let maxSlot = 1;
    programData.forEach(session => {
        if(!slotsGroups[session.slotNumber]) slotsGroups[session.slotNumber] = [];
        slotsGroups[session.slotNumber].push(session);
        let endSlot = parseInt(session.slotNumber) + parseInt(session.slotSpan) - 1;
        if(endSlot > maxSlot) maxSlot = endSlot;
    });

    // Nombre de sessions en parallèle à chaque créneau (ateliers longs compris)
    const concurrent = {};
    programData.forEach(session => {
        if (FULL_WIDTH_FORMATS.includes(session.slotFormat)) return;
        const span = parseInt(session.slotSpan) || 1;
        for (let k = 0; k < span; k++) {
            const slot = parseInt(session.slotNumber) + k;
            concurrent[slot] = (concurrent[slot] || 0) + 1;
        }
    });

    let reserved = []; // plages tenues par les ateliers sur plusieurs créneaux : {end, a, b}

    for(let s = 1; s <= maxSlot; s++) {
        const timeDiv = document.createElement("div");
        timeDiv.className = "time-slot";
        timeDiv.style.gridRow = `${s} / span 1`;
        timeDiv.style.gridColumn = "1 / 2";
        timeDiv.innerText = calculateTimeLabel(s);
        grid.appendChild(timeDiv);

        reserved = reserved.filter(r => r.end >= s);
        const here = slotsGroups[s] || [];
        const placements = [];

        // 1. Les sessions longues prennent une colonne à droite, à la largeur
        //    qu'elles auront au créneau le plus chargé qu'elles traversent
        here.filter(x => !FULL_WIDTH_FORMATS.includes(x.slotFormat) && (parseInt(x.slotSpan) || 1) > 1)
            .forEach(session => {
                const span = parseInt(session.slotSpan) || 1;
                let c = 1;
                for (let k = 0; k < span; k++) c = Math.max(c, concurrent[s + k] || 1);
                const right = Math.min(U, ...reserved.map(r => r.a));
                const a = Math.max(0, Math.round(right - U / c));
                reserved.push({ end: s + span - 1, a: a, b: right });
                placements.push([session, a, right]);
            });

        // 2. Le reste se partage la largeur libre à gauche
        const limit = Math.min(U, ...reserved.map(r => r.a));
        here.filter(x => FULL_WIDTH_FORMATS.includes(x.slotFormat))
            .forEach(session => placements.push([session, 0, limit]));
        const singles = here
            .filter(x => !FULL_WIDTH_FORMATS.includes(x.slotFormat) && (parseInt(x.slotSpan) || 1) === 1)
            .sort((x, y) => rooms.indexOf(columnKey(x)) - rooms.indexOf(columnKey(y)));
        singles.forEach((session, i) => {
            const w = limit / singles.length;
            placements.push([session, Math.round(i * w), Math.round((i + 1) * w)]);
        });

        placements.forEach(([session, a, b]) => {
            const isFullWidth = FULL_WIDTH_FORMATS.includes(session.slotFormat);
            const rowSpan = parseInt(session.slotSpan) || 1;

            const card = document.createElement("div");
            card.className = "session-card";
            if (isFullWidth) card.classList.add("session-full-width");
            if (session.slotFormat === 'Pause') card.classList.add("session-pause");

            card.style.gridRow = `${s} / span ${rowSpan}`;
            card.style.gridColumn = `${a + 2} / ${b + 2}`;

            card.innerHTML = `
                <div>
                    <h4 class="session-title">${session.sessionTitle}</h4>
                    <p class="session-speaker">${session.oratorName}</p>
                </div>
                <div class="session-footer">
                    <span class="session-format">${session.slotFormat}</span>
                    <span class="session-room">${session.location}</span>
                </div>
            `;

            card.addEventListener("click", () => openModal(s, session));
            grid.appendChild(card);
        });
    }
}

// Modal State
let currentModalSlot = null;
let currentSessionsInSlot = [];
let currentSessionIndex = 0;

function initModalLogic() {
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("session-modal").addEventListener("click", (e) => {
        if(e.target.id === "session-modal") closeModal(); // Click outside
    });
    
    document.getElementById("modal-prev").addEventListener("click", () => navigateModal(-1));
    document.getElementById("modal-next").addEventListener("click", () => navigateModal(1));
}

function openModal(slotNumber, session) {
    currentModalSlot = slotNumber;
    currentSessionsInSlot = slotsGroups[slotNumber] || [];
    currentSessionIndex = currentSessionsInSlot.indexOf(session);
    if(currentSessionIndex === -1) currentSessionIndex = 0;
    
    renderModalContent();
    document.getElementById("session-modal").classList.add("is-active");
    document.body.classList.add("no-scroll"); // Bloque le scroll derrière
}

function closeModal() {
    document.getElementById("session-modal").classList.remove("is-active");
    document.body.classList.remove("no-scroll");
}

function navigateModal(direction) {
    currentSessionIndex += direction;
    
    if(currentSessionIndex < 0) currentSessionIndex = 0;
    if(currentSessionIndex >= currentSessionsInSlot.length) currentSessionIndex = currentSessionsInSlot.length - 1;
    
    renderModalContent();
}

function renderModalContent() {
    const session = currentSessionsInSlot[currentSessionIndex];
    if(!session) return;

    const timeLabel = calculateTimeLabel(session.slotNumber, session.slotSpan, true);
    const positionMeta = `${currentSessionIndex + 1}/${currentSessionsInSlot.length}`;
    
    document.getElementById("modal-timeslot").innerText = `Créneau : ${timeLabel} • ${positionMeta}`;
    document.getElementById("modal-format").innerText = session.slotFormat;
    document.getElementById("modal-room").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${session.location}`;
    
    const cap = document.getElementById("modal-capacity");
    if(session.maxCapacity && session.maxCapacity !== "") {
        cap.style.display = "flex";
        cap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> max ${session.maxCapacity}`;
    } else {
        cap.style.display = "none";
    }

    document.getElementById("modal-track").innerText = `TRACK: ${session.sessionTrack}`;
    
    // Speaker Face
    const avatarBox = document.getElementById("modal-speaker-avatar");
    if(session.image && session.image.trim() !== "") {
        avatarBox.innerHTML = `<img src="${photoUrl(session.image)}" alt="${session.oratorName}" onerror="this.style.display='none'; this.parentElement.innerText='${getInitials(session.oratorName)}';">`;
    } else {
        avatarBox.innerHTML = getInitials(session.oratorName);
    }

    document.getElementById("modal-speaker-name").innerText = session.oratorName;
    document.getElementById("modal-speaker-job").innerText = session.company ? `${session.oratorJob} • ${session.company}` : session.oratorJob;
    
    // Mini biographie
    const bioBox = document.getElementById("modal-speaker-bio");
    if (bioBox) {
        bioBox.innerHTML = session.speakerBio || "";
        bioBox.style.display = session.speakerBio ? "" : "none";
    }

    // Link RS
    const linksBox = document.getElementById("modal-speaker-links");
    linksBox.innerHTML = "";
    if(session.linkedinUrl && session.linkedinUrl.startsWith("http")) {
        linksBox.innerHTML += `<a href="${session.linkedinUrl}" target="_blank" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>`;
    }

    // Session Text
    document.getElementById("modal-session-title").innerHTML = session.sessionTitle;
    document.getElementById("modal-session-desc").innerHTML = session.sessionDesc;

    // Nav logic
    document.getElementById("modal-prev").disabled = (currentSessionIndex === 0);
    document.getElementById("modal-next").disabled = (currentSessionIndex === currentSessionsInSlot.length - 1);

    // Pagination dots
    const dotsBox = document.getElementById("modal-dots");
    dotsBox.innerHTML = "";
    if(currentSessionsInSlot.length > 1) {
        for(let i=0; i<currentSessionsInSlot.length; i++) {
            const d = document.createElement("div");
            d.className = `dot ${i === currentSessionIndex ? 'is-active' : ''}`;
            dotsBox.appendChild(d);
        }
    }
}

function getInitials(name) {
    if(!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
}
