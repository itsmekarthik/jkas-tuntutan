const { useState, useEffect } = React;
const {
    ResponsiveContainer, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend
} = window.Recharts;

const Dashboard = () => {
    const [selectedFile, setSelectedFile] = useState('K.Parlimen.xlsx');
    const [selectedParlimen, setSelectedParlimen] = useState('All');
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Sample data
    const sampleData = [
        { name: 'Batu', value: 63118 },
        { name: 'Kepong', value: 25733 },
        { name: 'Wangsa Maju', value: 32350 },
        { name: 'Segambut', value: 75053 },
        { name: 'Setiawangsa', value: 40602 }
    ];

    useEffect(() => {
        setChartData(sampleData);
    }, []);

    return (
        <div className="w-full p-4">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block mb-2">Select Parlimen</label>
                        <select 
                            value={selectedParlimen}
                            onChange={(e) => setSelectedParlimen(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="All">All</option>
                            {sampleData.map(item => (
                                <option key={item.name} value={item.name}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#2563eb" name="Value" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};