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

    // Extraire les salles uniques
    const roomSet = new Set();
    programData.forEach(s => {
        if (s.location && s.location !== '-' && s.location !== 'Hall Admin') {
            roomSet.add(s.location);
        }
    });
    rooms = Array.from(roomSet).sort(); // Tri alpha ou personnalisable

    // Ajuster dynamiquement les colonnes de la grille
    grid.style.gridTemplateColumns = `120px repeat(${rooms.length}, 1fr)`;

    // Regrouper les slots
    let maxSlot = 1;
    programData.forEach(session => {
        if(!slotsGroups[session.slotNumber]) slotsGroups[session.slotNumber] = [];
        slotsGroups[session.slotNumber].push(session);
        let endSlot = parseInt(session.slotNumber) + parseInt(session.slotSpan) - 1;
        if(endSlot > maxSlot) maxSlot = endSlot;
    });

    // Dessiner la grille
    for(let s = 1; s <= maxSlot; s++) {
        // Dessiner l'entête horaire pour chaque ligne de la grille
        const timeDiv = document.createElement("div");
        timeDiv.className = "time-slot";
        timeDiv.style.gridRow = `${s} / span 1`;
        timeDiv.style.gridColumn = "1 / 2";
        timeDiv.innerText = calculateTimeLabel(s);
        grid.appendChild(timeDiv);

        // Placer les sessions
        if(slotsGroups[s]) {
            slotsGroups[s].forEach(session => {
                const isFullWidth = ['Pause', 'Plénière', 'Keynote'].includes(session.slotFormat);
                
                let colStart, colSpan;
                if (isFullWidth) {
                    colStart = 2;
                    colSpan = rooms.length; // S'étale sur toutes les salles
                } else {
                    const roomIndex = rooms.indexOf(session.location);
                    colStart = (roomIndex !== -1 ? roomIndex : 0) + 2; 
                    colSpan = 1;
                }

                const rowSpan = parseInt(session.slotSpan) || 1;
                
                const card = document.createElement("div");
                card.className = "session-card";
                
                // Si c'est un événement global, on ajoute une classe spécifique pour le styliser différemment
                if (isFullWidth) card.classList.add("session-full-width");
                if (session.slotFormat === 'Pause') card.classList.add("session-pause");
                
                card.style.gridRow = `${s} / span ${rowSpan}`;
                card.style.gridColumn = `${colStart} / span ${colSpan}`;
                
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
        avatarBox.innerHTML = `<img src="{{ 'assets/images/orators/' | relative_url}}${session.image}" alt="${session.oratorName}" onerror="this.style.display='none'; this.parentElement.innerText='${getInitials(session.oratorName)}';">`;
    } else {
        avatarBox.innerHTML = getInitials(session.oratorName);
    }

    document.getElementById("modal-speaker-name").innerText = session.oratorName;
    document.getElementById("modal-speaker-job").innerText = session.company ? `${session.oratorJob} • ${session.company}` : session.oratorJob;
    
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
