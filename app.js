const state = {
    templateImage: null,
    excelData: [],
    columns: [],
    selectedColumn: '',
    fontSize: 80,
    fontColor: '#1a1a1a',
    fontFamily: 'Poppins',
    textAlign: 'center',
    textPos: { x: 0.5, y: 0.5 }, // normalized positions (0-1)
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    canvas: null,
    ctx: null
};

// Initialize elements
const templateInput = document.getElementById('templateInput');
const excelInput = document.getElementById('excelInput');
const columnSelect = document.getElementById('columnSelect');
const fontSizeInput = document.getElementById('fontSize');
const fontColorInput = document.getElementById('fontColor');
const fontFamilyInput = document.getElementById('fontFamily');
const alignButtons = document.querySelectorAll('.btn-icon');
const downloadBtn = document.getElementById('downloadBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const draggableText = document.getElementById('draggableText');
const configPanel = document.getElementById('configPanel');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressSpan = document.getElementById('progress');
const dataCountSpan = document.getElementById('dataCount');

state.canvas = canvas;
state.ctx = ctx;

// Event Listeners
templateInput.addEventListener('change', handleTemplateUpload);
excelInput.addEventListener('change', handleExcelUpload);
fontSizeInput.addEventListener('input', (e) => { state.fontSize = e.target.value; updatePreview(); });
fontColorInput.addEventListener('input', (e) => { state.fontColor = e.target.value; updatePreview(); });
fontFamilyInput.addEventListener('change', (e) => { state.fontFamily = e.target.value; updatePreview(); });
columnSelect.addEventListener('change', (e) => { state.selectedColumn = e.target.value; updatePreview(); });

alignButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        alignButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.textAlign = btn.dataset.align;
        updatePreview();
    });
});

// Drag and Drop Logic
draggableText.addEventListener('mousedown', startDragging);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', stopDragging);

function startDragging(e) {
    state.isDragging = true;
    const rect = draggableText.getBoundingClientRect();
    state.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    draggableText.classList.add('dragging');
}

function drag(e) {
    if (!state.isDragging) return;

    const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();
    let x = e.clientX - containerRect.left - state.dragOffset.x;
    let y = e.clientY - containerRect.top - state.dragOffset.y;

    // Constrain within container
    x = Math.max(0, Math.min(x, containerRect.width - draggableText.offsetWidth));
    y = Math.max(0, Math.min(y, containerRect.height - draggableText.offsetHeight));

    draggableText.style.left = `${x}px`;
    draggableText.style.top = `${y}px`;

    // Update normalized position for rendering
    state.textPos.x = (x + draggableText.offsetWidth / 2) / containerRect.width;
    state.textPos.y = (y + draggableText.offsetHeight / 2) / containerRect.height;

    updatePreview();
}

function stopDragging() {
    state.isDragging = false;
    draggableText.classList.remove('dragging');
}

// File Handlers
async function handleTemplateUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.templateImage = img;
            document.getElementById('templateBox').classList.add('active');
            document.querySelector('.placeholder-text').style.display = 'none';
            draggableText.style.display = 'block';
            configPanel.style.display = 'block';
            checkReady();
            resizeCanvas();
            updatePreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length > 0) {
            state.excelData = jsonData;
            state.columns = Object.keys(jsonData[0]);

            // Populate column selector
            columnSelect.innerHTML = '<option value="">Select Name Column</option>';
            state.columns.forEach(col => {
                const opt = document.createElement('option');
                opt.value = col;
                opt.textContent = col;
                columnSelect.appendChild(opt);
            });

            document.getElementById('excelBox').classList.add('active');
            dataCountSpan.textContent = `${jsonData.length} Records Found`;
            checkReady();
        }
    };
    reader.readAsArrayBuffer(file);
}

function resizeCanvas() {
    if (!state.templateImage) return;
    const img = state.templateImage;
    canvas.width = img.width;
    canvas.height = img.height;
}

function updatePreview() {
    if (!state.templateImage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.templateImage, 0, 0);

    const sampleText = state.excelData.length > 0 && state.selectedColumn
        ? state.excelData[0][state.selectedColumn]
        : 'Sample Name';

    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width / canvas.width;

    draggableText.querySelector('span').textContent = sampleText;
    draggableText.querySelector('span').style.fontFamily = state.fontFamily;
    draggableText.querySelector('span').style.fontSize = `${state.fontSize * ratio}px`;
    draggableText.querySelector('span').style.color = state.fontColor;

    // Draw on actual canvas (for eventual generation)
    // Removed because draggableText (HTML) is used for UI preview
    // renderTextOnCanvas(ctx, sampleText, canvas.width, canvas.height);
}

function renderTextOnCanvas(targetCtx, text, width, height) {
    targetCtx.font = `${state.fontSize}px "${state.fontFamily}"`;
    targetCtx.fillStyle = state.fontColor;
    targetCtx.textAlign = state.textAlign;
    targetCtx.textBaseline = 'middle';

    let x = width * state.textPos.x;
    const y = height * state.textPos.y;

    targetCtx.fillText(text, x, y);
}

function checkReady() {
    if (state.templateImage && state.excelData.length > 0) {
        downloadBtn.disabled = false;
        downloadPdfBtn.disabled = false;
    }
}

// Bulk PNG Generation (ZIP)
downloadBtn.addEventListener('click', async () => {
    if (!state.templateImage || state.excelData.length === 0 || !state.selectedColumn) {
        alert('Please complete all steps first!');
        return;
    }

    loadingOverlay.style.display = 'flex';
    const zip = new JSZip();
    const total = state.excelData.length;

    for (let i = 0; i < total; i++) {
        const row = state.excelData[i];
        let name = row[state.selectedColumn];

        if (name === undefined || name === null || name === '') {
            name = `Participant_${i + 1}`;
        } else {
            name = String(name).trim();
        }

        const genCanvas = document.createElement('canvas');
        genCanvas.width = state.templateImage.width;
        genCanvas.height = state.templateImage.height;
        const genCtx = genCanvas.getContext('2d');

        genCtx.drawImage(state.templateImage, 0, 0);
        renderTextOnCanvas(genCtx, name, genCanvas.width, genCanvas.height);

        const dataUrl = genCanvas.toDataURL('image/png', 1.0);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        const safeName = name.replace(/[^a-z0-9]/gi, '_');
        const fileName = `${String(i + 1).padStart(3, '0')}_${safeName}.png`;

        zip.file(fileName, base64Data, { base64: true });

        const percent = Math.round(((i + 1) / total) * 100);
        progressSpan.textContent = percent;

        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "certificates.zip");
    loadingOverlay.style.display = 'none';
});

// Bulk PDF Generation
downloadPdfBtn.addEventListener('click', async () => {
    if (!state.templateImage || state.excelData.length === 0 || !state.selectedColumn) {
        alert('Please complete all steps first!');
        return;
    }

    loadingOverlay.style.display = 'flex';
    const { jsPDF } = window.jspdf;
    const total = state.excelData.length;

    const img = state.templateImage;
    const pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height]
    });

    for (let i = 0; i < total; i++) {
        const row = state.excelData[i];
        let name = row[state.selectedColumn];

        if (name === undefined || name === null || name === '') {
            name = `Participant_${i + 1}`;
        } else {
            name = String(name).trim();
        }

        if (i > 0) pdf.addPage([img.width, img.height], img.width > img.height ? 'l' : 'p');

        const genCanvas = document.createElement('canvas');
        genCanvas.width = img.width;
        genCanvas.height = img.height;
        const genCtx = genCanvas.getContext('2d');

        genCtx.drawImage(img, 0, 0);
        renderTextOnCanvas(genCtx, name, genCanvas.width, genCanvas.height);

        const imgData = genCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, img.width, img.height);

        const percent = Math.round(((i + 1) / total) * 100);
        progressSpan.textContent = percent;

        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    pdf.save("certificates.pdf");
    loadingOverlay.style.display = 'none';
});

// Update preview on resize to keep text scale accurate
window.addEventListener('resize', updatePreview);

