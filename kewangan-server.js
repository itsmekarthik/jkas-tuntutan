const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

console.log('Starting Kewangan Dashboard Server...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Environment:', process.env.NODE_ENV || 'development');

const app = express();
const port = process.env.PORT || 3001;

console.log('Using port:', port);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static('.'));

// Database configuration
const dbConfig = {
    user: 'jkasadmin',
    password: 'P@ssw0rd',
    server: 'jkas-server.database.windows.net', // You can change this to your server name if different
    database: 'jkasdb',
    options: {
        encrypt: true, // Use this if you're on localhost and don't have SSL
        trustServerCertificate: false, // Use this if you're on localhost
        enableArithAbort: true // Required for SQL Server 2019 and later
    }
};

// Connect to database
async function connectDB() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server database: JKAS');
    } catch (err) {
        console.error('Database connection failed:', err);
        // Don't crash the app if database connection fails
        console.log('Application will continue to run without database connection');
    }
}

// Initialize database connection
connectDB();

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'Kewangan Dashboard',
        port: port,
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Kewangan Server is Running!</h1>
                <p>Port: ${port}</p>
                <p>Time: ${new Date().toISOString()}</p>
                <p>Node: ${process.version}</p>
                <a href="/kewangan.html">Go to Main App</a>
            </body>
        </html>
    `);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'kewangan.html'));
});

// API endpoint to get tuntutan data
app.get('/api/tuntutan', async (req, res) => {
    try {
        const { perkhidmatan, parlimen, tahun, bulan } = req.query;
        
        let query = `
            SELECT 
                omp_id,
                lokasi,
                frekuensi,
                parlimen,
                catatan,
                domestic_rate,
                domestic_freq,
                domestic_total,
                pukal_rate,
                pukal_freq,
                pukal_total,
                kadar,
                rujuken_tarikh_serahan
            FROM omp_baru
            WHERE 1=1
        `;
        
        const request = new sql.Request();
        
        // Add parlimen filter
        if (parlimen) {
            query += ` AND parlimen = @parlimen`;
            request.input('parlimen', sql.NVarChar, parlimen);
        }
        
        // Add year and month filtering
        if (tahun) {
            query += ` AND rujuken_tarikh_serahan LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                      AND TRY_CAST(rujuken_tarikh_serahan AS date) IS NOT NULL
                      AND YEAR(TRY_CAST(rujuken_tarikh_serahan AS date)) = @tahun`;
            request.input('tahun', sql.Int, parseInt(tahun));
            
            // Add month filter if provided
            if (bulan) {
                query += ` AND MONTH(TRY_CAST(rujuken_tarikh_serahan AS date)) = @bulan`;
                request.input('bulan', sql.Int, parseInt(bulan));
            }
        }
        
        console.log('Executing query:', query);
        console.log('Query parameters:', { parlimen, tahun, bulan });
        
        const result = await request.query(query);
        console.log('Query result:', result.recordset.length, 'rows returned');
        
        // Simplified transformation - determine category based on existing columns only
        const transformedData = result.recordset.map((row) => {
            const domesticTotal = row.domestic_total && row.domestic_total !== '' ? parseFloat(row.domestic_total) : 0;
            const pukalTotal = row.pukal_total && row.pukal_total !== '' ? parseFloat(row.pukal_total) : 0;
            const kadarValue = row.kadar && row.kadar !== '' ? parseFloat(row.kadar) : 
                              row.domestic_rate && row.domestic_rate !== '' ? parseFloat(row.domestic_rate) :
                              row.pukal_rate && row.pukal_rate !== '' ? parseFloat(row.pukal_rate) : 0;
            
            // Simplified service category determination based on existing data
            let serviceCategory = 'CUCIAN'; // Default
            if (domesticTotal > 0 || pukalTotal > 0) {
                serviceCategory = 'KUTIPAN';
            } else if (row.lokasi && (row.lokasi.toLowerCase().includes('jalan') || 
                      row.lokasi.toLowerCase().includes('sapuan'))) {
                serviceCategory = 'SAPUAN';
            }
            
            return {
                id: row.omp_id,
                butir: row.lokasi || '',
                jenisAktiviti: serviceCategory,
                frekuensi: row.frekuensi || row.domestic_freq || row.pukal_freq || 0,
                inventori: domesticTotal || pukalTotal || 0,
                unitUkuran: 'Unit',
                kadarHarga: kadarValue,
                jumlah: domesticTotal || pukalTotal || 0,
                jumlahKeseluruhan: domesticTotal + pukalTotal,
                parlimen: row.parlimen || '',
                catatan: row.catatan || '',
                checked: false
            };
        });
        
        res.json(transformedData);
    } catch (err) {
        console.error('Error fetching tuntutan data:', err);
        console.error('Error details:', err.message);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ 
            error: 'Failed to fetch data', 
            details: err.message,
            sqlError: err.originalError?.info?.message || 'Unknown SQL error'
        });
    }
});

// API endpoint to get distinct parlimen values
app.get('/api/parlimen-list', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT parlimen 
            FROM omp_baru 
            WHERE parlimen IS NOT NULL AND parlimen != ''
            ORDER BY parlimen
        `;
        
        const result = await sql.query(query);
        const parlimenList = result.recordset.map(row => row.parlimen);
        
        res.json(parlimenList);
    } catch (err) {
        console.error('Error fetching parlimen list:', err);
        res.status(500).json({ error: 'Failed to fetch parlimen list' });
    }
});

// API endpoint to get chart data
app.get('/api/chart-data', async (req, res) => {
    try {
        const { view, month, year } = req.query;
        
        let query, groupByColumn;
        let dateFilter = '';
        
        // Add date filtering if year is provided - only for proper date formats
        if (year) {
            dateFilter = ` AND rujuken_tarikh_serahan LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                          AND TRY_CAST(rujuken_tarikh_serahan AS date) IS NOT NULL
                          AND YEAR(TRY_CAST(rujuken_tarikh_serahan AS date)) = ${parseInt(year)}`;
        }
        
        // Add month filtering if month is provided
        if (month) {
            dateFilter += ` AND MONTH(TRY_CAST(rujuken_tarikh_serahan AS date)) = ${parseInt(month)}`;
        }
        
        if (view === 'parlimen') {
            groupByColumn = 'parlimen';
            query = `
                SELECT 
                    parlimen as category,
                    COUNT(*) as total,
                    SUM(CAST(ISNULL(TRY_CAST(domestic_total AS FLOAT), 0) + ISNULL(TRY_CAST(pukal_total AS FLOAT), 0) AS FLOAT)) as amount
                FROM omp_baru 
                WHERE parlimen IS NOT NULL 
                AND parlimen != ''
                ${dateFilter}
                GROUP BY parlimen
                ORDER BY amount DESC
            `;
        } else {
            // Group by service type (domestic vs pukal)
            query = `
                SELECT 
                    CASE 
                        WHEN domestic_total IS NOT NULL AND domestic_total != '' THEN 'Domestic'
                        WHEN pukal_total IS NOT NULL AND pukal_total != '' THEN 'Pukal'
                        ELSE 'Other'
                    END as category,
                    COUNT(*) as total,
                    SUM(CAST(ISNULL(TRY_CAST(domestic_total AS FLOAT), 0) + ISNULL(TRY_CAST(pukal_total AS FLOAT), 0) AS FLOAT)) as amount
                FROM omp_baru 
                WHERE (domestic_total IS NOT NULL AND domestic_total != '') 
                   OR (pukal_total IS NOT NULL AND pukal_total != '')
                ${dateFilter}
                GROUP BY 
                    CASE 
                        WHEN domestic_total IS NOT NULL AND domestic_total != '' THEN 'Domestic'
                        WHEN pukal_total IS NOT NULL AND pukal_total != '' THEN 'Pukal'
                        ELSE 'Other'
                    END
                ORDER BY amount DESC
            `;
        }
        
        console.log('Chart query:', query);
        const result = await sql.query(query);
        
        const chartData = {
            labels: result.recordset.map(row => row.category),
            values: result.recordset.map(row => row.amount || row.total || 0)
        };
        
        res.json(chartData);
    } catch (err) {
        console.error('Error fetching chart data:', err);
        console.error('Error details:', err.message);
        res.status(500).json({ error: 'Failed to fetch chart data', details: err.message });
    }
});

// Add this endpoint to check table structure
app.get('/api/table-info', async (req, res) => {
    try {
        const query = `
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'omp_baru'
            ORDER BY ORDINAL_POSITION
        `;
        
        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching table info:', err);
        res.status(500).json({ error: 'Failed to fetch table info', details: err.message });
    }
});

// Update the debug endpoint to show date parsing results
app.get('/api/debug-dates', async (req, res) => {
    try {
        const query = `
            SELECT TOP 20
                rujuken_tarikh_serahan,
                CASE 
                    WHEN rujuken_tarikh_serahan LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN 'Valid Format'
                    ELSE 'Invalid Format'
                END as format_status,
                TRY_CAST(rujuken_tarikh_serahan AS date) as parsed_date,
                CASE 
                    WHEN TRY_CAST(rujuken_tarikh_serahan AS date) IS NOT NULL 
                    THEN YEAR(TRY_CAST(rujuken_tarikh_serahan AS date))
                    ELSE NULL 
                END as extracted_year
            FROM omp_baru 
            WHERE rujuken_tarikh_serahan IS NOT NULL 
            AND rujuken_tarikh_serahan != ''
            ORDER BY 
                CASE 
                    WHEN rujuken_tarikh_serahan LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN 1
                    ELSE 2
                END,
                rujuken_tarikh_serahan DESC
        `;
        
        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error checking date format:', err);
        res.status(500).json({ error: 'Failed to check date format', details: err.message });
    }
});

// Remove the complex determineServiceCategory function since we're using simplified logic

// Add debug endpoint to see service categorization
app.get('/api/debug-categories/:year', async (req, res) => {
    try {
        const year = req.params.year;
        
        const query = `
            SELECT TOP 20
                omp_id,
                lokasi,
                domestic_total,
                pukal_total,
                domestic_rate,
                pukal_rate,
                kadar,
                rujuken_tarikh_serahan
            FROM omp_baru 
            WHERE rujuken_tarikh_serahan LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND TRY_CAST(rujuken_tarikh_serahan AS date) IS NOT NULL
            AND YEAR(TRY_CAST(rujuken_tarikh_serahan AS date)) = ${year}
        `;
        
        const result = await sql.query(query);
        
        const categorizedData = result.recordset.map(row => {
            const domesticTotal = parseFloat(row.domestic_total || 0);
            const pukalTotal = parseFloat(row.pukal_total || 0);
            
            // Simplified categorization
            let category = 'CUCIAN';
            if (domesticTotal > 0 || pukalTotal > 0) {
                category = 'KUTIPAN';
            } else if (row.lokasi && (row.lokasi.toLowerCase().includes('jalan') || 
                      row.lokasi.toLowerCase().includes('sapuan'))) {
                category = 'SAPUAN';
            }
            
            return {
                omp_id: row.omp_id,
                lokasi: row.lokasi,
                determined_category: category,
                domestic_total: row.domestic_total,
                pukal_total: row.pukal_total,
                rujuken_tarikh_serahan: row.rujuken_tarikh_serahan
            };
        });
        
        // Count by category
        const categoryCounts = {
            KUTIPAN: categorizedData.filter(item => item.determined_category === 'KUTIPAN').length,
            SAPUAN: categorizedData.filter(item => item.determined_category === 'SAPUAN').length,
            CUCIAN: categorizedData.filter(item => item.determined_category === 'CUCIAN').length
        };
        
        res.json({
            total_records: categorizedData.length,
            category_counts: categoryCounts,
            sample_data: categorizedData
        });
        
    } catch (err) {
        console.error('Debug categories error:', err);
        res.status(500).json({ error: 'Debug failed', details: err.message });
    }
});

// Catch-all route for debugging
app.get('*', (req, res) => {
    console.log('Unhandled route accessed:', req.path);
    res.status(404).send(`
        <html>
            <body>
                <h1>404 - Route Not Found</h1>
                <p>Path: ${req.path}</p>
                <p>Available routes:</p>
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/test">Test Page</a></li>
                    <li><a href="/api/health">Health Check</a></li>
                    <li><a href="/kewangan.html">Main App</a></li>
                </ul>
            </body>
        </html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server with better error handling for Azure
app.listen(port, '0.0.0.0', () => {
    console.log(`Kewangan server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server started at: ${new Date().toISOString()}`);
    console.log(`Open http://localhost:${port}/kewangan.html to view the application`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});

// Add global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    try {
        await sql.close();
        console.log('Database connection closed.');
    } catch (err) {
        console.error('Error closing database connection:', err);
    }
    process.exit(0);
});
