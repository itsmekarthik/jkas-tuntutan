// API base URL
const API_BASE_URL = 'http://localhost:3001/api';

// Global variable to store table data
let tableData = [];

// Global variables
let tuntutanData = [];
let myChart = null;

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Kewangan application...');
    
    try {
        // Setup year dropdowns
        populateYearDropdowns();
        
        // Load parlimen options
        await loadParlimenOptions();
        
        // Bind the updateChart function to the button
        const updateChartButton = document.getElementById('update-chart');
        if (updateChartButton) {
            updateChartButton.addEventListener('click', updateChart);
        }
        
        // Bind PDF generation to the button
        const generatePDFButton = document.getElementById('generate-pdf');
        if (generatePDFButton) {
            generatePDFButton.addEventListener('click', generatePDFReport);
            console.log('PDF generation button bound successfully');
        } else {
            console.warn('PDF generation button not found');
        }
        
        // Set default month to current month
        const chartMonthSelect = document.getElementById('chart-month');
        if (chartMonthSelect) {
            chartMonthSelect.value = new Date().getMonth() + 1;
        }
        
        // Load initial data for 2025 only
        console.log('Loading initial data for year 2025...');
        await Promise.all([
            loadTableData({ tahun: '2025' }), // Load 2025 data by default
            updateChartData('parlimen', '', '2025') // Load 2025 chart data
        ]);
        
        // Update filter display
        updateFilterDisplay({ tahun: '2025' });
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Error loading initial data. Please refresh the page.');
    }
});

// Function to display table data (this was missing)
function displayTableData(data) {
    const tbody = document.getElementById('tuntutan-body');
    if (!tbody) {
        console.error('Table body element not found');
        return;
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Create table rows
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.butir || ''}</td>
            <td>${item.jenisAktiviti || 'TBD'}</td>
            <td>${item.frekuensi || 0}</td>
            <td>${item.inventori || 0}</td>
            <td>${item.unitUkuran || 'Unit'}</td>
            <td>RM ${(item.kadarHarga || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>RM ${(item.jumlah || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>RM ${(item.jumlahKeseluruhan || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>${item.parlimen || ''}</td>
            <td>${item.catatan || ''}</td>
            <td><input type="checkbox" data-index="${index}" ${item.checked ? 'checked' : ''} onchange="toggleRowSelection(${index}, this.checked)"></td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`Displayed ${data.length} rows in table`);
}

// Function to toggle row selection
function toggleRowSelection(index, checked) {
    if (window.tuntutanData && window.tuntutanData[index]) {
        window.tuntutanData[index].checked = checked;
        console.log(`Row ${index} ${checked ? 'checked' : 'unchecked'}`);
    }
}

// Modified loadTableData function with default year filter
async function loadTableData(filters = {}) {
    try {
        // Default to current year (2025) if no year is specified
        if (!filters.tahun) {
            filters.tahun = '2025';
        }
        
        // Build URL with filters
        const params = new URLSearchParams();
        
        if (filters.parlimen) {
            params.append('parlimen', filters.parlimen);
        }
        
        if (filters.tahun) {
            params.append('tahun', filters.tahun);
        }
        
        // Add month parameter
        if (filters.bulan) {
            params.append('bulan', filters.bulan);
        }
        
        if (filters.perkhidmatan && filters.perkhidmatan !== 'All') {
            params.append('perkhidmatan', filters.perkhidmatan);
        }
        
        const url = `/api/tuntutan?${params.toString()}`;
        console.log('Fetching table data from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Table data received:', data.length, 'records');
        
        // Store the data globally
        window.tuntutanData = data;
        
        // Update the table display
        displayTableData(data);
        
        // Update summary information
        updateSummary(data);
        
        return data;
        
    } catch (error) {
        console.error('Error loading table data:', error);
        throw new Error('Failed to fetch data from server');
    }
}

// Combined update function for both chart and table
async function updateChart() {
    try {
        // Get current filter values from the form
        const view = document.getElementById('chart-view').value;
        const month = document.getElementById('chart-month').value;
        const year = document.getElementById('chart-year').value;
        const parlimen = document.getElementById('parlimen').value;
        const perkhidmatan = document.getElementById('perkhidmatan').value;
        
        console.log('Updating chart and table with filters:', { view, month, year, parlimen, perkhidmatan });
        
        // Update both chart and table simultaneously with month filter
        await Promise.all([
            updateChartData(view, month, year),
            loadTableData({ parlimen, tahun: year, bulan: month, perkhidmatan }) // Pass month here
        ]);
        
        // Update the display to show current filters
        updateFilterDisplay({ parlimen, tahun: year, bulan: month, perkhidmatan });
        
    } catch (error) {
        console.error('Error updating chart and table:', error);
        alert('Error updating data. Please try again.');
    }
}

// Separate function for updating chart data only
async function updateChartData(view, month, year) {
    try {
        let url = `/api/chart-data?view=${view}`;
        
        if (month) {
            url += `&month=${month}`;
        }
        
        if (year) {
            url += `&year=${year}`;
        }
        
        console.log('Fetching chart data from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Chart data received:', data);
        
        // Update the chart
        if (window.myChart) {
            window.myChart.data.labels = data.labels;
            window.myChart.data.datasets[0].data = data.values;
            window.myChart.update();
        } else {
            // Create chart if it doesn't exist
            createChart(data);
        }
        
    } catch (error) {
        console.error('Error updating chart:', error);
        throw error;
    }
}

// Function to create initial chart
function createChart(data) {
    const ctx = document.getElementById('data-chart').getContext('2d');
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Total Amount (RM)',
                data: data.values,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'RM ' + value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Amount: RM ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Function to update filter display
function updateFilterDisplay(filters) {
    const filterInfo = document.getElementById('currentFilters');
    if (filterInfo) {
        let filterText = 'Current filters: ';
        const activeFilters = [];
        
        if (filters.parlimen) {
            activeFilters.push(`Parlimen: ${filters.parlimen}`);
        }
        
        if (filters.tahun) {
            activeFilters.push(`Year: ${filters.tahun}`);
        }
        
        if (filters.bulan) {
            activeFilters.push(`Month: ${filters.bulan}`);
        }
        
        if (filters.perkhidmatan && filters.perkhidmatan !== 'All') {
            activeFilters.push(`Service: ${filters.perkhidmatan}`);
        }
        
        if (activeFilters.length > 0) {
            filterText += activeFilters.join(', ');
        } else {
            filterText += 'Year: 2025 (default)';
        }
        
        filterInfo.textContent = filterText;
    }
}

// Function to update summary information
function updateSummary(data) {
    const totalRecords = data.length;
    const totalAmount = data.reduce((sum, item) => sum + (item.jumlahKeseluruhan || 0), 0);
    
    // Update summary display if elements exist
    const recordCountElement = document.getElementById('recordCount');
    const totalAmountElement = document.getElementById('totalAmount');
    
    if (recordCountElement) {
        recordCountElement.textContent = `Total Records: ${totalRecords}`;
    }
    
    if (totalAmountElement) {
        totalAmountElement.textContent = `Total Amount: RM ${totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
    }
}

// Function to populate year dropdowns
function populateYearDropdowns() {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Add years from 2020 to current year + 1
    for (let year = currentYear + 1; year >= 2020; year--) {
        years.push(year);
    }
    
    // Populate main year dropdown
    const tahunSelect = document.getElementById('tahun');
    if (tahunSelect) {
        tahunSelect.innerHTML = '';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === 2025) option.selected = true; // Default to 2025
            tahunSelect.appendChild(option);
        });
    }
    
    // Populate chart year dropdown
    const chartYearSelect = document.getElementById('chart-year');
    if (chartYearSelect) {
        chartYearSelect.innerHTML = '';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === 2025) option.selected = true; // Default to 2025
            chartYearSelect.appendChild(option);
        });
    }
}

// Function to load parlimen options from API
async function loadParlimenOptions() {
    try {
        const response = await fetch('/api/parlimen-list');
        const parlimenList = await response.json();
        
        const parlimenSelect = document.getElementById('parlimen');
        if (parlimenSelect && Array.isArray(parlimenList)) {
            // Clear existing options except "All"
            parlimenSelect.innerHTML = '<option value="">All</option>';
            
            // Add parlimen options
            parlimenList.forEach(parlimen => {
                const option = document.createElement('option');
                option.value = parlimen;
                option.textContent = parlimen;
                parlimenSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading parlimen options:', error);
    }
}

// Function to generate PDF report with claimed/unclaimed sections
async function generatePDFReport() {
    try {
        // Check if we have data to export
        if (!window.tuntutanData || window.tuntutanData.length === 0) {
            alert('Tiada data untuk dijana PDF. Sila muat data terlebih dahulu.');
            return;
        }
        
        // Get current filters for report header
        const currentFilters = getCurrentFilters();
        
        // Import jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for better table fit
        
        // Set up document properties
        doc.setProperties({
            title: 'Laporan Tuntutan Perkhidmatan STANDARD',
            subject: 'Financial Report',
            author: 'JKAS System',
            creator: 'JKAS Web Application'
        });
        
        // Add header
        let currentY = addPDFHeader(doc, currentFilters);
        
        // Separate claimed and unclaimed items
        const claimedItems = window.tuntutanData.filter(item => item.checked === true);
        const unclaimedItems = window.tuntutanData.filter(item => item.checked !== true);
        
        // Add claimed items section
        if (claimedItems.length > 0) {
            currentY = addClaimedSection(doc, claimedItems, currentY);
        }
        
        // Add unclaimed items section
        if (unclaimedItems.length > 0) {
            currentY = addUnclaimedSection(doc, unclaimedItems, currentY);
        }
        
        // Add footer with page numbers
        addPDFPageNumbers(doc);
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `tuntutan_report_${timestamp}.pdf`;
        
        // Save the PDF
        doc.save(filename);
        
        console.log('PDF generated successfully:', filename);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Ralat semasa menjana PDF. Sila cuba lagi.');
    }
}

// Function to get current filter values
function getCurrentFilters() {
    return {
        tahun: document.getElementById('chart-year')?.value || new Date().getFullYear(),
        bulan: document.getElementById('chart-month')?.value || '',
        parlimen: document.getElementById('parlimen')?.value || 'Semua',
        perkhidmatan: document.getElementById('perkhidmatan')?.value || 'All'
    };
}

// Function to add PDF header
function addPDFHeader(doc, filters) {
    // Set font for title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    
    // Add main title
    doc.text('Laporan Tuntutan Perkhidmatan STANDARD', 148, 20, { align: 'center' });
    
    // Add filter information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 35;
    doc.text(`Tarikh: ${new Date().toLocaleDateString('en-GB')}`, 20, yPos);
    yPos += 8;
    doc.text(`Tahun: ${filters.tahun}`, 20, yPos);
    yPos += 8;
    doc.text(`Perkhidmatan: ${filters.perkhidmatan}`, 20, yPos);
    yPos += 8;
    doc.text(`Parlimen: ${filters.parlimen}`, 20, yPos);
    
    return yPos + 15;
}

// Function to add claimed items section
function addClaimedSection(doc, claimedItems, startY) {
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resit Yang Dituntut', 20, startY);
    
    // Prepare table data
    const tableData = claimedItems.map(item => [
        item.butir || '',
        item.jenisAktiviti || '',
        (item.frekuensi || 0).toString(),
        (item.inventori || 0).toFixed(2),
        item.unitUkuran || '',
        `${(item.kadarHarga || 0).toFixed(4)}`,
        `${(item.jumlah || 0).toFixed(2)}`,
        item.parlimen || '',
        item.catatan || '',
        'Claimed'
    ]);
    
    // Add table
    doc.autoTable({
        startY: startY + 8,
        head: [['Butir-Butir', 'Jenis Aktiviti', 'Frekuensi', 'Inventori', 'Unit', 'Kadar (RM)', 'Jumlah (RM)', 'Parlimen', 'Catatan', 'Status']],
        body: tableData,
        styles: { 
            fontSize: 8, 
            cellPadding: 1.5,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 45 }, // Butir-Butir
            1: { cellWidth: 20 }, // Jenis Aktiviti
            2: { cellWidth: 15, halign: 'center' }, // Frekuensi
            3: { cellWidth: 18, halign: 'right' }, // Inventori
            4: { cellWidth: 10, halign: 'center' }, // Unit
            5: { cellWidth: 18, halign: 'right' }, // Kadar
            6: { cellWidth: 20, halign: 'right' }, // Jumlah
            7: { cellWidth: 25 }, // Parlimen
            8: { cellWidth: 35 }, // Catatan
            9: { cellWidth: 15, halign: 'center' } // Status
        },
        margin: { left: 20, right: 20 },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        }
    });
    
    return doc.lastAutoTable.finalY + 15;
}

// Function to add unclaimed items section
function addUnclaimedSection(doc, unclaimedItems, startY) {
    // Check if we need a new page
    if (startY > 180) {
        doc.addPage();
        startY = 20;
    }
    
    // Add separator line
    doc.setLineWidth(0.5);
    doc.line(20, startY - 5, 276, startY - 5);
    
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resit Yang Belum Dituntut', 20, startY + 5);
    
    // Prepare table data
    const tableData = unclaimedItems.map(item => [
        item.butir || '',
        item.jenisAktiviti || '',
        (item.frekuensi || 0).toString(),
        (item.inventori || 0).toFixed(2),
        item.unitUkuran || '',
        `${(item.kadarHarga || 0).toFixed(4)}`,
        `${(item.jumlah || 0).toFixed(2)}`,
        item.parlimen || '',
        item.catatan || '',
        'Unclaimed'
    ]);
    
    // Add table
    doc.autoTable({
        startY: startY + 13,
        head: [['Butir-Butir', 'Jenis Aktiviti', 'Frekuensi', 'Inventori', 'Unit', 'Kadar (RM)', 'Jumlah (RM)', 'Parlimen', 'Catatan', 'Status']],
        body: tableData,
        styles: { 
            fontSize: 8, 
            cellPadding: 1.5,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [231, 76, 60],
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 45 }, // Butir-Butir
            1: { cellWidth: 20 }, // Jenis Aktiviti
            2: { cellWidth: 15, halign: 'center' }, // Frekuensi
            3: { cellWidth: 18, halign: 'right' }, // Inventori
            4: { cellWidth: 10, halign: 'center' }, // Unit
            5: { cellWidth: 18, halign: 'right' }, // Kadar
            6: { cellWidth: 20, halign: 'right' }, // Jumlah
            7: { cellWidth: 25 }, // Parlimen
            8: { cellWidth: 35 }, // Catatan
            9: { cellWidth: 15, halign: 'center' } // Status
        },
        margin: { left: 20, right: 20 },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        }
    });
    
    return doc.lastAutoTable.finalY + 10;
}

// Function to add page numbers
function addPDFPageNumbers(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Muka ${i} daripada ${pageCount}`, 
                 doc.internal.pageSize.width - 30, 
                 doc.internal.pageSize.height - 10);
    }
}

// Update the existing displayTableData function to properly handle checkboxes
function displayTableData(data) {
    const tbody = document.getElementById('tuntutan-body');
    if (!tbody) {
        console.error('Table body element not found');
        return;
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Create table rows
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.butir || ''}</td>
            <td>${item.jenisAktiviti || 'TBD'}</td>
            <td>${item.frekuensi || 0}</td>
            <td>${item.inventori || 0}</td>
            <td>${item.unitUkuran || 'Unit'}</td>
            <td>RM ${(item.kadarHarga || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>RM ${(item.jumlah || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>RM ${(item.jumlahKeseluruhan || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
            <td>${item.parlimen || ''}</td>
            <td>${item.catatan || ''}</td>
            <td><input type="checkbox" data-index="${index}" ${item.checked ? 'checked' : ''} onchange="toggleRowSelection(${index}, this.checked)"></td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`Displayed ${data.length} rows in table`);
}

// Update the toggleRowSelection function
function toggleRowSelection(index, checked) {
    if (window.tuntutanData && window.tuntutanData[index]) {
        window.tuntutanData[index].checked = checked;
        console.log(`Row ${index} ${checked ? 'checked' : 'unchecked'}`);
    }
}

// Update the DOMContentLoaded event listener to include PDF button
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Kewangan application...');
    
    try {
        // Setup year dropdowns
        populateYearDropdowns();
        
        // Load parlimen options
        await loadParlimenOptions();
        
        // Bind the updateChart function to the button
        const updateChartButton = document.getElementById('update-chart');
        if (updateChartButton) {
            updateChartButton.addEventListener('click', updateChart);
        }
        
        // Bind PDF generation to the button
        const generatePDFButton = document.getElementById('generate-pdf');
        if (generatePDFButton) {
            generatePDFButton.addEventListener('click', generatePDFReport);
            console.log('PDF generation button bound successfully');
        } else {
            console.warn('PDF generation button not found');
        }
        
        // Set default month to current month
        const chartMonthSelect = document.getElementById('chart-month');
        if (chartMonthSelect) {
            chartMonthSelect.value = new Date().getMonth() + 1;
        }
        
        // Load initial data for 2025 only
        console.log('Loading initial data for year 2025...');
        await Promise.all([
            loadTableData({ tahun: '2025' }), // Load 2025 data by default
            updateChartData('parlimen', '', '2025') // Load 2025 chart data
        ]);
        
        // Update filter display
        updateFilterDisplay({ tahun: '2025' });
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Error loading initial data. Please refresh the page.');
    }
});

// Export functions for global access
window.generatePDFReport = generatePDFReport;
window.updateChart = updateChart;
window.loadTableData = loadTableData;
window.toggleRowSelection = toggleRowSelection;