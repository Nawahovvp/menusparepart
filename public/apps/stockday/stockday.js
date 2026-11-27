
    console.log('Script started loading');
    if (!window.React || !window.ReactDOM || !window.axios || !window.Recharts || !window.Babel) {
      document.getElementById('root').innerHTML = `
        <div class="flex justify-center items-center h-screen">
          <p class="text-xl text-red-600">เกิดข้อผิดพลาด: ไม่สามารถโหลดไลบรารีที่จำเป็นได้</p>
        </div>
      `;
      throw new Error('Missing required libraries');
    }

    const API_WEB_URL = '/api/web-data';
    const API_LOGIN_URL = '/api/login';
    const API_SESSION_URL = '/api/session';
    const API_LOGOUT_URL = '/api/logout';
    const apiConfig = {
      withCredentials: true,
      headers: { 'X-Requested-With': 'CallSparePartApp' }
    };
    const apiGet = (url) => axios.get(url, apiConfig);
    const apiPost = (url, data) => axios.post(url, data, apiConfig);

    function getHubSessionUser() {
      try {
        const raw =
          localStorage.getItem('plant_hub_user_session_v2') ||
          sessionStorage.getItem('plant_hub_user_session_v2');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const u = parsed && parsed.user ? parsed.user : null;
        if (!u) return null;
        return {
          ...u,
          IDUser: String(u.IDRec || u.IDUser || '').trim(),
          Name: u.Name || 'ผู้ใช้งาน',
          Plant: u.Plant || '-'
        };
      } catch {
        return null;
      }
    }


    class ErrorBoundary extends React.Component {
      state = { error: null };
      static getDerivedStateFromError(error) {
        console.error('ErrorBoundary caught:', error);
        return { error };
      }
      render() {
        if (this.state.error) {
          return (
            <div class="flex justify-center items-center h-screen">
              <p class="text-xl text-red-600">
                เกิดข้อผิดพลาด: {this.state.error.message}
              </p>
            </div>
          );
        }
        return this.props.children;
      }
    }
    const formatNumber = (num) => {
      if (isNaN(num) || num === null || num === undefined) return '0';
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
      if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
      return num.toFixed(0);
    };
    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        // คำนวณมูลค่ารวมสำหรับแท่งกราฟที่ stack กัน (มูลค่าคลัง + มูลค่าวิศวกรรม)
        const totalValue = payload.reduce((sum, entry) => {
          if (entry.dataKey === 'มูลค่าคลังรวม' || entry.dataKey === 'มูลค่าคลัง') {
            return sum + (entry.value || 0);
          } else if (entry.dataKey === 'มูลค่าวิศวกรรม') {
            return sum + (entry.value || 0);
          }
          return sum;
        }, 0);
        return (
          <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
            <p className="font-bold">{label}</p>
            {payload.map((entry, index) => (
              <p key={index} className="text-sm">
                {entry.name}: {formatNumber(entry.value)} {entry.unit || 'บาท'}
              </p>
            ))}
            {totalValue > 0 && (
              <p className="text-sm font-bold text-blue-600 mt-1">
                มูลค่ารวม: {formatNumber(totalValue)} บาท
              </p>
            )}
          </div>
        );
      }
      return null;
    };
    const LoginForm = ({ onLogin }) => {
      const [username, setUsername] = React.useState('');
      const [password, setPassword] = React.useState('');
      const [rememberMe, setRememberMe] = React.useState(false);
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        const storedUsername = localStorage.getItem('rememberedUsername');
        const storedPassword = localStorage.getItem('rememberedPassword');
        if (storedUsername && storedPassword) {
          setUsername(storedUsername);
          setPassword(storedPassword);
          setRememberMe(true);
        }
      }, []);

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
          setError('กรุณากรอก Username และ Password');
          return;
        }
        try {
          const response = await apiPost(API_LOGIN_URL, {
            username,
            password
          });
          if (rememberMe) {
            localStorage.setItem('rememberedUsername', username);
            localStorage.setItem('rememberedPassword', password);
          } else {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
          }
          onLogin(response.data.user);
          setError('');
        } catch (err) {
          const serverMessage = err.response?.data?.error || '';
          let message = 'Username หรือ Password ไม่ถูกต้อง';
          if (serverMessage === 'Missing credentials') {
            message = 'กรุณากรอก Username และ Password';
          } else if (serverMessage === 'Invalid credentials') {
            message = 'Username หรือ Password ไม่ถูกต้อง';
          } else if (serverMessage === 'Login failed') {
            message = 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
          }
          setError(message);
        }
      };
      return (
        <div class="flex justify-center items-center h-screen bg-gray-100">
          <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h2 class="text-2xl font-bold text-center text-blue-800 mb-6">เข้าสู่ระบบ</h2>
            <form onSubmit={handleSubmit}>
              <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div class="mb-6">
                <label class="block text-gray-700 text-sm font-bold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div class="mb-4 flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  class="mr-2"
                />
                <label class="text-gray-700 text-sm">จดจำ Username และ Password</label>
              </div>
              {error && <p class="text-red-500 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200"
              >
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      );
    };
    const UserPopup = ({ isOpen, onClose, user, handleLogout }) => {
      if (!isOpen || !user) return null;
      return (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-[95%] max-w-md p-6 relative">
            <button
              onClick={onClose}
              class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
            >
              Close
            </button>
            <h2 class="text-xl font-semibold text-blue-800 mb-4">รายละเอียดผู้ใช้</h2>
            <div class="space-y-4">
              <p><strong>รหัสพนักงาน:</strong> {user.IDRec}</p>
              <p><strong>ชื่อ:</strong> {user.Name}</p>
              <p><strong>ตำแหน่ง:</strong> {user['ตำแหน่ง']}</p>
              <p><strong>หน่วยงาน:</strong> {user['หน่วยงาน']}</p>
            </div>
            <div class="mt-6">
              <button
                onClick={handleLogout}
                class="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      );
    };
    const PrintReport = ({ warehouse, historyData }) => {
    const limitedHistoryData = historyData.slice(-1);
    if (!limitedHistoryData || limitedHistoryData.length === 0) {
      return (
        <div class="print-container bg-white">
          <p class="text-xl text-red-600 text-center">ไม่มีข้อมูลสำหรับคลังนี้</p>
        </div>
      );
    }
    const latestData = limitedHistoryData[limitedHistoryData.length - 1] || {};
    const stockBegin = parseFloat(latestData['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
    const stockEnd = parseFloat(latestData['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
    const engBegin = parseFloat(latestData['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
    const engEnd = parseFloat(latestData['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
    const totalBeginx = parseFloat(latestData['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0;
    const totalEndx = parseFloat(latestData['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0;
    const totalStock = totalBeginx + totalEndx;
    const totalEng = engEnd;
    const totalValue = totalBeginx + totalEndx;
    const cost = parseFloat(latestData['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0;
    const stockDay = Math.round(parseFloat(latestData['Stock Day']?.toString().replace(/,/g, '')) || 0);
    return (
      <div class="print-container bg-white">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div class="bg-blue-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-blue-900">มูลค่ารวมทั้งหมด</h3>
            <p class="text-xl font-bold text-blue-600">{formatNumber(totalValue)} บาท</p>
          </div>
          <div class="bg-green-200 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-green-900">มูลค่าคลังรวม</h3>
            <p class="text-xl font-bold text-green-700">{formatNumber(totalStock)} บาท</p>
          </div>
          <div class="bg-purple-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-purple-800">มูลค่าวิศวกรรม</h3>
            <p class="text-xl font-bold text-purple-600">{formatNumber(totalEng)} บาท</p>
          </div>
          <div class="bg-orange-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-orange-800">ต้นทุนขาย</h3>
            <p class="text-xl font-bold text-orange-600">{formatNumber(cost)} บาท</p>
          </div>
          <div class="bg-green-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-green-800">Stock Day</h3>
            <p class="text-xl font-bold text-green-600">{stockDay} วัน</p>
          </div>
        </div>
        <div class="chart-container w-full h-[600px]">
          <Recharts.ResponsiveContainer width="100%" height="100%">
            <Recharts.ComposedChart data={limitedHistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <Recharts.CartesianGrid strokeDasharray="3 3" />
              <Recharts.XAxis
                dataKey="Mountyear"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
                tick={{ fontSize: 12 }}
              />
              <Recharts.YAxis
                yAxisId="left"
                label={{ value: 'มูลค่า (บาท)', angle: -90, position: 'insideLeft', offset: -10 }}
                tickFormatter={formatNumber}
                tick={{ fontSize: 12 }}
              />
              <Recharts.YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Stock Day (วัน)', angle: 90, position: 'insideRight', offset: -10 }}
                tick={{ fontSize: 12 }}
              />
              <Recharts.Tooltip content={<CustomTooltip />} />
              <Recharts.Legend verticalAlign="top" height={36} />
              <Recharts.Bar
                yAxisId="left"
                dataKey="มูลค่าคลังรวม"
                name="คลัง"
                stackId="a"
                fill="#15803D"
                barSize={20}
                unit="บาท"
              />
              <Recharts.Bar
                yAxisId="left"
                dataKey="มูลค่าวิศวกรรม"
                name="วิศวกรรม"
                stackId="a"
                fill="#6B21A8"
                barSize={20}
                unit="บาท"
              >
                <Recharts.LabelList
                  dataKey="ปลายงวดมูลค่ารวม"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 12, fill: '#f1f5f9', fontWeight: 'bold' }}
                />
              </Recharts.Bar>
              <Recharts.Line
                yAxisId="left"
                type="monotone"
                dataKey="ต้นทุนขาย"
                name="ต้นทุนขาย"
                stroke="#F97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                unit="บาท"
              >
                <Recharts.LabelList
                  dataKey="ต้นทุนขาย"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 12, fill: '#F97316', fontWeight: 'bold' }}
                />
              </Recharts.Line>
              <Recharts.Line
                yAxisId="right"
                type="monotone"
                dataKey="Stock Day"
                name="Stock Day"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4 }}
                unit="วัน"
              >
                <Recharts.LabelList
                  dataKey="Stock Day"
                  position="top"
                  formatter={(value) => `${Math.round(value)} วัน`}
                  style={{ fontSize: 12, fill: '#fbbf24', fontWeight: 'bold' }}
                />
              </Recharts.Line>
              <Recharts.ReferenceLine
                yAxisId="right"
                y={180}
                label={{ value: 'เป้าหมาย 180 วัน', position: 'insideTop', fill: '#fca5a5', fontSize: 13, fontWeight: 'bold' }}
                stroke="#f87171"
                strokeDasharray="5 5"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            </Recharts.ComposedChart>
          </Recharts.ResponsiveContainer>
        </div>
      </div>
    );
  };
  const PrintSummaryReport = ({ historyData }) => {
    const limitedHistoryData = historyData.slice(-1);
    const latestData = limitedHistoryData[limitedHistoryData.length - 1] || {};
    const totalValue = parseFloat(latestData['มูลค่าทั้งหมด']?.toString().replace(/,/g, '')) || 0;
    const totalStock = parseFloat(latestData['มูลค่าคลังรวม']?.toString().replace(/,/g, '')) || 0;
    const totalEng = parseFloat(latestData['มูลค่าวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
    const totalCost = parseFloat(latestData['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0;
    const stockDay = Math.round(parseFloat(latestData['Stock Day']?.toString().replace(/,/g, '')) || 0);
    return (
      <div class="print-container bg-white">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div class="bg-blue-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-blue-900">มูลค่ารวมทั้งหมด</h3>
            <p class="text-xl font-bold text-blue-600">{formatNumber(totalValue)} บาท</p>
          </div>
          <div class="bg-green-200 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-green-900">มูลค่าคลังรวม</h3>
            <p class="text-xl font-bold text-green-700">{formatNumber(totalStock)} บาท</p>
          </div>
          <div class="bg-purple-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-purple-800">มูลค่าวิศวกรรม</h3>
            <p class="text-xl font-bold text-purple-600">{formatNumber(totalEng)} บาท</p>
          </div>
          <div class="bg-orange-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-orange-800">ต้นทุนขาย</h3>
            <p class="text-xl font-bold text-orange-600">{formatNumber(totalCost)} บาท</p>
          </div>
          <div class="bg-green-100 p-4 rounded-lg shadow">
            <h3 class="text-base font-semibold text-green-800">Stock Day</h3>
            <p class="text-xl font-bold text-green-600">{stockDay} วัน</p>
          </div>
        </div>
        <div class="chart-container w-full h-[600px]">
          <Recharts.ResponsiveContainer width="100%" height="100%">
            <Recharts.ComposedChart data={limitedHistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <Recharts.CartesianGrid strokeDasharray="3 3" />
              <Recharts.XAxis
                dataKey="Mountyear"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
                tick={{ fontSize: 12 }}
              />
              <Recharts.YAxis
                yAxisId="left"
                label={{ value: 'มูลค่า (บาท)', angle: -90, position: 'insideLeft', offset: -10 }}
                tickFormatter={formatNumber}
                tick={{ fontSize: 12 }}
              />
              <Recharts.YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Stock Day (วัน)', angle: 90, position: 'insideRight', offset: -10 }}
                tick={{ fontSize: 12 }}
              />
              <Recharts.Tooltip content={<CustomTooltip />} />
              <Recharts.Legend verticalAlign="top" height={36} />
              <Recharts.Bar
                yAxisId="left"
                dataKey="มูลค่าคลังรวม"
                name="คลัง"
                stackId="a"
                fill="#15803D"
                barSize={20}
                unit="บาท"
              />
              <Recharts.Bar
                yAxisId="left"
                dataKey="มูลค่าวิศวกรรม"
                name="วิศวกรรม"
                stackId="a"
                fill="#6B21A8"
                barSize={20}
                unit="บาท"
              >
                <Recharts.LabelList
                  dataKey="ปลายงวดมูลค่ารวม"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 12, fill: '#f1f5f9', fontWeight: 'bold' }}
                />
              </Recharts.Bar>
              <Recharts.Line
                yAxisId="left"
                type="monotone"
                dataKey="ต้นทุนขาย"
                name="ต้นทุนขาย"
                stroke="#F97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                unit="บาท"
              >
                <Recharts.LabelList
                  dataKey="ต้นทุนขาย"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 12, fill: '#F97316', fontWeight: 'bold' }}
                />
              </Recharts.Line>
              <Recharts.Line
                yAxisId="right"
                type="monotone"
                dataKey="Stock Day"
                name="Stock Day"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4 }}
                unit="วัน"
              >
                <Recharts.LabelList
                  dataKey="Stock Day"
                  position="top"
                  formatter={(value) => `${Math.round(value)} วัน`}
                  style={{ fontSize: 12, fill: '#fbbf24', fontWeight: 'bold' }}
                />
              </Recharts.Line>
              <Recharts.ReferenceLine
                yAxisId="right"
                y={180}
                label={{ value: 'เป้าหมาย 180 วัน', position: 'insideTop', fill: '#fca5a5', fontSize: 13, fontWeight: 'bold' }}
                stroke="#f87171"
                strokeDasharray="5 5"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            </Recharts.ComposedChart>
          </Recharts.ResponsiveContainer>
        </div>
      </div>
    );
  };
    const HistoryPopup = ({ isOpen, onClose, warehouse, data }) => {
      const [rangeMode, setRangeMode] = React.useState('1y');
      React.useEffect(() => {
        if (isOpen) setRangeMode('1y');
      }, [isOpen, warehouse]);
      if (!isOpen) return null;
      const historyData = data
        .filter(item => item['ชื่อคลัง'] === warehouse)
        .map(item => {
          const stockBegin = parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
          const stockEnd = parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
          const engBegin = parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
          const engEnd = parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
          return {
            ...item,
            'มูลค่าคลังรวม': (stockEnd),
            'มูลค่าวิศวกรรม': (engEnd),
            'ต้นทุนขาย': parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0,
            'Stock Day': Math.round(parseFloat(item['Stock Day']?.toString().replace(/,/g, '')) || 0)
          };
        })
        .sort((a, b) => {
          const [monthA, yearA] = a['Mountyear']?.split('/') || ['01', '2000'];
          const [monthB, yearB] = b['Mountyear']?.split('/') || ['01', '2000'];
          const dateA = new Date(`${yearA}-${monthA}-01`);
          const dateB = new Date(`${yearB}-${monthB}-01`);
          return dateA - dateB;
        });
      const handlePrint = () => {
        if (!historyData || historyData.length === 0) {
          alert('ไม่มีข้อมูลสำหรับพิมพ์');
          return;
        }
        const printRoot = document.getElementById('print-root');
        if (!printRoot) {
          console.error('Print root element not found');
          return;
        }
        printRoot.style.display = 'block';
        printRoot.innerHTML = '';
        try {
          ReactDOM.render(
            <PrintReport warehouse={warehouse} historyData={historyData} />,
            printRoot,
            () => {
              console.log('PrintReport rendered successfully');
              setTimeout(() => {
                console.log('Calling window.print()');
                window.print();
                printRoot.style.display = 'none';
                ReactDOM.unmountComponentAtNode(printRoot);
              }, 1000);
            }
          );
        } catch (error) {
          console.error('Error rendering print report:', error);
          printRoot.style.display = 'none';
          alert('เกิดข้อผิดพลาดในการพิมพ์: ' + error.message);
        }
      };
      const chartData = rangeMode === '1y' ? historyData.slice(-12) : historyData;
      const latestData = historyData[historyData.length - 1] || {};
      const latestStock = latestData['มูลค่าคลังรวม'] || 0;
      const latestEng = latestData['มูลค่าวิศวกรรม'] || 0;
      const latestTotal = latestStock + latestEng;
      const latestCost = parseFloat(latestData['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0;
      const latestStockDay = latestData['Stock Day'] || 0;
      return (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-[95%] max-w-6xl p-6 relative pt-20">
            <div class="no-print absolute top-4 left-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRangeMode('1y')}
                title="แสดง 1 ปีย้อนหลัง (12 เดือน)"
                aria-label="แสดง 1 ปีย้อนหลัง"
                class={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${rangeMode === '1y' ? 'bg-blue-600 text-white shadow-md border border-blue-400' : 'bg-slate-700/70 text-slate-200 border border-slate-500/50 hover:bg-slate-600/80'}`}
              >
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <text x="12" y="18.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">1Y</text>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setRangeMode('all')}
                title={`แสดงทั้งหมด (${historyData.length} เดือน)`}
                aria-label="แสดงทั้งหมด"
                class={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${rangeMode === 'all' ? 'bg-blue-600 text-white shadow-md border border-blue-400' : 'bg-slate-700/70 text-slate-200 border border-slate-500/50 hover:bg-slate-600/80'}`}
              >
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              class="no-print absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              class="no-print absolute top-4 right-24 bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600"
            >
              Print
            </button>
            <h2 class="text-2xl font-semibold text-blue-800 mb-4">
              รายงานมูลค่า Sparepart และ Stock Day ศูนย์: {warehouse} ประจำเดือน {latestData['Mountyear'] || 'ไม่ระบุ'}
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div class="bg-blue-100 p-4 rounded-lg shadow">
  <h3 class="text-base font-semibold text-blue-900">มูลค่ารวมทั้งหมด</h3>
  <p class="text-xl font-bold text-blue-600">{formatNumber(latestTotal)} บาท</p>
</div>
              <div class="bg-green-200 p-4 rounded-lg shadow">
  <h3 class="text-base font-semibold text-green-900">มูลค่าคลังรวม</h3>
  <p class="text-xl font-bold text-green-700">{formatNumber(latestStock)} บาท</p>
</div>
              <div class="bg-purple-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-purple-800">มูลค่าวิศวกรรม</h3>
                <p class="text-xl font-bold text-purple-600">{formatNumber(latestEng)} บาท</p>
              </div>
              <div class="bg-orange-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-orange-800">ต้นทุนขาย</h3>
                <p class="text-xl font-bold text-orange-600">{formatNumber(latestCost)} บาท</p>
              </div>
              <div class="bg-green-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-green-800">Stock Day</h3>
                <p class="text-xl font-bold text-green-600">{latestStockDay} วัน</p>
              </div>
            </div>
            <div class="w-full h-[400px]">
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <Recharts.CartesianGrid strokeDasharray="3 3" />
                  <Recharts.XAxis
                    dataKey="Mountyear"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={80}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.YAxis
                    yAxisId="left"
                    label={{ value: 'มูลค่า (บาท)', angle: -90, position: 'insideLeft', offset: -10 }}
                    tickFormatter={formatNumber}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Stock Day (วัน)', angle: 90, position: 'insideRight', offset: -10 }}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.Tooltip content={<CustomTooltip />} />
                  <Recharts.Legend verticalAlign="top" height={36} />
                  <Recharts.Bar
                    yAxisId="left"
                    dataKey="มูลค่าคลังรวม"
                    name="คลัง"
                    stackId="a"
                    fill="#15803D"
                    barSize={20}
                    unit="บาท"
                  />
                  <Recharts.Bar
                    yAxisId="left"
                    dataKey="มูลค่าวิศวกรรม"
                    name="วิศวกรรม"
                    stackId="a"
                    fill="#6B21A8"
                    barSize={20}
                    unit="บาท"
                  >
                    <Recharts.LabelList
                      dataKey="ปลายงวดมูลค่ารวม"
                      position="top"
                      formatter={formatNumber}
                      style={{ fontSize: 12, fill: '#f1f5f9', fontWeight: 'bold' }}
                    />
                  </Recharts.Bar>
                  <Recharts.Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ต้นทุนขาย"
                    name="ต้นทุนขาย"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    unit="บาท"
                  >
                    <Recharts.LabelList
                      dataKey="ต้นทุนขาย"
                      position="top"
                      formatter={formatNumber}
                      style={{ fontSize: 12, fill: '#F97316', fontWeight: 'bold' }}
                    />
                  </Recharts.Line>
                  <Recharts.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Stock Day"
                    name="Stock Day"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    unit="วัน"
                  >
                    <Recharts.LabelList
                      dataKey="Stock Day"
                      position="top"
                      formatter={(value) => `${Math.round(value)} วัน`}
                      style={{ fontSize: 12, fill: '#fbbf24', fontWeight: 'bold' }}
                    />
                  </Recharts.Line>
                  <Recharts.ReferenceLine
                    yAxisId="right"
                    y={180}
                    label={{ value: 'เป้าหมาย 180 วัน', position: 'insideTop', fill: '#fca5a5', fontSize: 13, fontWeight: 'bold' }}
                    stroke="#f87171"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                  />
                </Recharts.ComposedChart>
              </Recharts.ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    };
    const SummaryHistoryPopup = ({ isOpen, onClose, data }) => {
      const [rangeMode, setRangeMode] = React.useState('1y');
      React.useEffect(() => {
        if (isOpen) setRangeMode('1y');
      }, [isOpen]);
      if (!isOpen) return null;
      const getDaysInLastMonth = (monthYear) => {
  if (!monthYear) return 30;
  let [month, year] = monthYear.split('/').map(Number);
  year -= 543; // แปลงปีพ.ศ. เป็นค.ศ.
  const date = new Date(year, month, 0); // ใช้เดือนปัจจุบัน
  return date.getDate();
};
const summaryData = [...new Set(data.map(item => item['Mountyear']))]
  .filter(my => my)
  .map(mountyear => {
    const mountyearData = data.filter(item => item['Mountyear'] === mountyear);
    const totalValuebegin = mountyearData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
    const totalValueEnd = mountyearData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
    const totalValue = (totalValuebegin + totalValueEnd) / 2;
    const totalStock = mountyearData.reduce((sum, item) => {
      const stockEnd = parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
      return sum + stockEnd;
    }, 0);
    const totalEng = mountyearData.reduce((sum, item) => {
      const engEnd = parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
      return sum + engEnd;
    }, 0);
    const totalCost = mountyearData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
    const stockDay = totalCost > 0 ? Math.round((totalValue / totalCost) * getDaysInLastMonth(mountyear)) : 0;
    return {
      Mountyear: mountyear,
      'มูลค่าทั้งหมด': totalValue,
      'มูลค่าคลังรวม': totalStock,
      'มูลค่าวิศวกรรม': totalEng,
      'ต้นทุนขาย': totalCost,
      'Stock Day': stockDay,
      'ปลายงวดมูลค่ารวม': totalValueEnd
    };
  })
  .sort((a, b) => {
    const [monthA, yearA] = a.Mountyear?.split('/') || ['01', '2000'];
    const [monthB, yearB] = b.Mountyear?.split('/') || ['01', '2000'];
    const dateA = new Date(`${yearA}-${monthA}-01`);
    const dateB = new Date(`${yearB}-${monthB}-01`);
    return dateA - dateB;
  });
      const handlePrint = () => {
        if (!summaryData || summaryData.length === 0) {
          alert('ไม่มีข้อมูลสำหรับพิมพ์');
          return;
        }
        const printRoot = document.getElementById('print-root');
        if (!printRoot) {
          console.error('Print root element not found');
          return;
        }
        printRoot.style.display = 'block';
        printRoot.innerHTML = '';
        try {
          ReactDOM.render(
            <PrintSummaryReport historyData={summaryData} />,
            printRoot,
            () => {
              console.log('PrintSummaryReport rendered successfully');
              setTimeout(() => {
                console.log('Calling window.print()');
                window.print();
                printRoot.style.display = 'none';
                ReactDOM.unmountComponentAtNode(printRoot);
              }, 1000);
            }
          );
        } catch (error) {
          console.error('Error rendering print report:', error);
          printRoot.style.display = 'none';
          alert('เกิดข้อผิดพลาดในการพิมพ์: ' + error.message);
        }
      };
      const chartSummaryData = rangeMode === '1y' ? summaryData.slice(-12) : summaryData;
      const latestData = summaryData[summaryData.length - 1] || {};
      const latestTotalValue = latestData['มูลค่าทั้งหมด'] || 0;
      const latestStock = latestData['มูลค่าคลังรวม'] || 0;
      const latestEng = latestData['มูลค่าวิศวกรรม'] || 0;
      const latestCost = latestData['ต้นทุนขาย'] || 0;
      const latestStockDay = latestData['Stock Day'] || 0;
      return (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-[95%] max-w-6xl p-6 relative pt-20">
            <div class="no-print absolute top-4 left-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRangeMode('1y')}
                title="แสดง 1 ปีย้อนหลัง (12 เดือน)"
                aria-label="แสดง 1 ปีย้อนหลัง"
                class={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${rangeMode === '1y' ? 'bg-blue-600 text-white shadow-md border border-blue-400' : 'bg-slate-700/70 text-slate-200 border border-slate-500/50 hover:bg-slate-600/80'}`}
              >
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <text x="12" y="18.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">1Y</text>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setRangeMode('all')}
                title={`แสดงทั้งหมด (${summaryData.length} เดือน)`}
                aria-label="แสดงทั้งหมด"
                class={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${rangeMode === 'all' ? 'bg-blue-600 text-white shadow-md border border-blue-400' : 'bg-slate-700/70 text-slate-200 border border-slate-500/50 hover:bg-slate-600/80'}`}
              >
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              class="no-print absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              class="no-print absolute top-4 right-24 bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600"
            >
              Print
            </button>
            <h2 class="text-2xl font-semibold text-blue-800 mb-4">
              รายงานสรุปมูลค่า Sparepart และ Stock Day ประจำเดือน {latestData['Mountyear'] || 'ไม่ระบุ'}
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div class="bg-blue-100 p-4 rounded-lg shadow">
  <h3 class="text-base font-semibold text-blue-900">มูลค่ารวมทั้งหมด</h3>
  <p class="text-xl font-bold text-blue-600">{formatNumber(latestTotalValue)} บาท</p>
</div>
              <div class="bg-green-200 p-4 rounded-lg shadow">
  <h3 class="text-base font-semibold text-green-900">มูลค่าคลังรวม</h3>
  <p class="text-xl font-bold text-green-700">{formatNumber(latestStock)} บาท</p>
</div>
              <div class="bg-purple-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-purple-800">มูลค่าวิศวกรรม</h3>
                <p class="text-xl font-bold text-purple-600">{formatNumber(latestEng)} บาท</p>
              </div>
              <div class="bg-orange-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-orange-800">ต้นทุนขาย</h3>
                <p class="text-xl font-bold text-orange-600">{formatNumber(latestCost)} บาท</p>
              </div>
              <div class="bg-green-100 p-4 rounded-lg shadow">
                <h3 class="text-base font-semibold text-green-800">Stock Day</h3>
                <p class="text-xl font-bold text-green-600">{latestStockDay} วัน</p>
              </div>
            </div>
            <div class="w-full h-[400px]">
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.ComposedChart data={chartSummaryData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <Recharts.CartesianGrid strokeDasharray="3 3" />
                  <Recharts.XAxis
                    dataKey="Mountyear"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={80}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.YAxis
                    yAxisId="left"
                    label={{ value: 'มูลค่า (บาท)', angle: -90, position: 'insideLeft', offset: -10 }}
                    tickFormatter={formatNumber}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Stock Day (วัน)', angle: 90, position: 'insideRight', offset: -10 }}
                    tick={{ fontSize: 12 }}
                  />
                  <Recharts.Tooltip content={<CustomTooltip />} />
                  <Recharts.Legend verticalAlign="top" height={36} />
                  <Recharts.Bar
                    yAxisId="left"
                    dataKey="มูลค่าคลังรวม"
                    name="คลัง"
                    stackId="a"
                    fill="#15803D"
                    barSize={20}
                    unit="บาท"
                  />
                  <Recharts.Bar
                    yAxisId="left"
                    dataKey="มูลค่าวิศวกรรม"
                    name="วิศวกรรม"
                    stackId="a"
                    fill="#6B21A8"
                    barSize={20}
                    unit="บาท"
                  >
                    <Recharts.LabelList
                      dataKey="ปลายงวดมูลค่ารวม"
                      position="top"
                      formatter={formatNumber}
                      style={{ fontSize: 12, fill: '#f1f5f9', fontWeight: 'bold' }}
                    />
                  </Recharts.Bar>
                  <Recharts.Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ต้นทุนขาย"
                    name="ต้นทุนขาย"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    unit="บาท"
                  >
                    <Recharts.LabelList
                      dataKey="ต้นทุนขาย"
                      position="top"
                      formatter={formatNumber}
                      style={{ fontSize: 12, fill: '#F97316', fontWeight: 'bold' }}
                    />
                  </Recharts.Line>
                  <Recharts.Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Stock Day"
                    name="Stock Day"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    unit="วัน"
                  >
                    <Recharts.LabelList
                      dataKey="Stock Day"
                      position="top"
                      formatter={(value) => `${Math.round(value)} วัน`}
                      style={{ fontSize: 12, fill: '#fbbf24', fontWeight: 'bold' }}
                    />
                  </Recharts.Line>
                  <Recharts.ReferenceLine
                    yAxisId="right"
                    y={180}
                    label={{ value: 'เป้าหมาย 180 วัน', position: 'insideTop', fill: '#fca5a5', fontSize: 13, fontWeight: 'bold' }}
                    stroke="#f87171"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                  />
                </Recharts.ComposedChart>
              </Recharts.ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    };
    const SevenElevenChart = ({ selectedMonthYear }) => {
      const [chartData, setChartData] = React.useState([]);
      const [loading, setLoading] = React.useState(true);
      React.useEffect(() => {
        if (!selectedMonthYear) {
          setChartData([]);
          setLoading(false);
          return;
        }
        const url = API_WEB_URL;
        apiGet(url).then(response => {
          const rows = response.data;
          const filtered = rows.filter(row => row.Mountyear === selectedMonthYear && row['Stock Day'] !== 'On Process');
          const processed = filtered.map(row => {
            const storeNum = parseFloat(row.Store?.toString().replace(/,/g, '')) || 1;
            const totalValue = parseFloat(row['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0;
            const totalCost = parseFloat(row['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0;
            return {
              ...row,
              Status: row['ชื่อคลัง'].startsWith('SA-') ? 'SA' : 'COMPANY',
              Store: storeNum,
              StoreValue: totalValue / storeNum,
              CostStore: totalCost / storeNum,
            };
          }).sort((a, b) => {
            if (a.Status !== b.Status) return a.Status.localeCompare(b.Status);
            return b.StoreValue - a.StoreValue;
          });
          setChartData(processed);
          setLoading(false);
        }).catch(err => {
          console.error(err);
          setLoading(false);
        });
      }, [selectedMonthYear]);
      if (loading) return <div class="text-center text-gray-600">กำลังโหลดข้อมูล 7-11...</div>;
      if (chartData.length === 0) return <div class="text-center text-gray-600">ไม่มีข้อมูลสำหรับเดือนที่เลือก</div>;
      return (
        <div class="mb-12">
          <h2 class="text-2xl font-semibold text-blue-800 mb-4 tracking-wide leading-relaxed shadow-md">รายงานมูลค่าการใช้อะไหล่ต่อสาขา 7-11 ({selectedMonthYear})</h2>
          <div class="w-full h-[500px]">
            <Recharts.ResponsiveContainer width="100%" height="100%">
              <Recharts.ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                <Recharts.CartesianGrid strokeDasharray="3 3" />
                <Recharts.XAxis dataKey="ชื่อคลัง" angle={-45} textAnchor="end" interval={0} height={100} tick={{ fontSize: 12 }} />
                <Recharts.YAxis yAxisId="left" label={{ value: 'จำนวนสาขา', angle: -90, position: 'insideLeft', offset: -10 }} tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
                <Recharts.YAxis yAxisId="right" orientation="right" label={{ value: 'มูลค่า (บาท)', angle: 90, position: 'insideRight', offset: -10 }} tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
                <Recharts.Tooltip
                  formatter={(value, name) => {
                    if (name === 'สาขา') return [formatNumber(value), 'สาขา'];
                    return [formatNumber(value), 'บาท'];
                  }}
                />
                <Recharts.Legend verticalAlign="top" height={36} />
                <Recharts.Bar yAxisId="left" dataKey="Store" name="สาขา" fill="rgba(129, 140, 248, 0.48)" radius={[4, 4, 0, 0]} barSize={20} />
                <Recharts.Line yAxisId="right" type="monotone" dataKey="StoreValue" name="มูลค่าคงเหลือต่อสาขา" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1.5 }}>
                  <Recharts.LabelList dataKey="StoreValue" position="top" offset={8} formatter={formatNumber} style={{ fontSize: 12, fill: '#7dd3fc', fontWeight: 'bold' }} />
                </Recharts.Line>
                <Recharts.Line yAxisId="right" type="monotone" dataKey="CostStore" name="มูลค่าใช้จริงต่อสาขา" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 1.5 }}>
                  <Recharts.LabelList dataKey="CostStore" position="top" offset={8} formatter={formatNumber} style={{ fontSize: 12, fill: '#fde68a', fontWeight: 'bold' }} />
                </Recharts.Line>
              </Recharts.ComposedChart>
            </Recharts.ResponsiveContainer>
          </div>
        </div>
      );
    };
    const App = () => {
      const [data, setData] = React.useState([]);
      const [filteredData, setFilteredData] = React.useState([]);
      const [monthYears, setMonthYears] = React.useState([]);
      const [selectedMonthYear, setSelectedMonthYear] = React.useState('');
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [showHistoryPopup, setShowHistoryPopup] = React.useState(false);
      const [selectedWarehouse, setSelectedWarehouse] = React.useState('');
      const [showSummaryHistoryPopup, setShowSummaryHistoryPopup] = React.useState(false);
      const [isLoggedIn, setIsLoggedIn] = React.useState(false);
      const [currentUser, setCurrentUser] = React.useState(null);
      const [showUserPopup, setShowUserPopup] = React.useState(false);
      React.useEffect(() => {
        const hubUser = getHubSessionUser();
        if (hubUser && hubUser.IDUser) {
          setCurrentUser(hubUser);
          setIsLoggedIn(true);
          return;
        }
        apiGet(API_SESSION_URL)
          .then(response => {
            const user = response.data?.user || null;
            if (user) {
              setCurrentUser(user);
              setIsLoggedIn(true);
            }
          })
          .catch(err => {
            console.error('Session check failed:', err);
          });
      }, []);
      React.useEffect(() => {
        const url = API_WEB_URL;
        apiGet(url)
          .then(response => {
            const rows = response.data;
            if (!rows || rows.length === 0) {
              setError('ไม่มีข้อมูลใน Google Sheet');
              setLoading(false);
              return;
            }
            const cleanedData = rows.map(row => {
              const beginValue = parseFloat(row['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0;
              const endValue = parseFloat(row['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0;
              const costValue = parseFloat(row['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0;
              const stockBegin = parseFloat(row['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
              const stockEnd = parseFloat(row['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
              const engBegin = parseFloat(row['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
              const engEnd = parseFloat(row['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
              const storeValue = parseFloat(row['Store']?.toString().replace(/,/g, '')) || 0;
              const nonStoreValue = parseFloat(row['NonStore']?.toString().replace(/,/g, '')) || 0;
              return {
                ...row,
                'Store': storeValue,
                'NonStore': nonStoreValue,
                'ต้นงวดคลัง': stockBegin,
                'ต้นงวดวิศวกรรม': engBegin,
                'ต้นงวดมูลค่ารวม': beginValue,
                'ปลายงวดคลัง': stockEnd,
                'ปลายงวดวิศวกรรม': engEnd,
                'ปลายงวดมูลค่ารวม': endValue,
                'ต้นทุนขาย': costValue,
                'Stock Day': parseFloat(row['Stock Day']?.toString().replace(/,/g, '')) || 0,
                'Mountyear': row['Mountyear']?.trim() || '',
                'ชื่อคลัง': row['ชื่อคลัง']?.trim() || '',
                'StatusSAcom': row['StatusSAcom']?.trim() || '',
                'มูลค่าคลังรวม': stockEnd,
                'มูลค่าคลัง': stockEnd,
                'มูลค่าวิศวกรรม': engEnd
              };
            });
            const monthYearSet = new Set(cleanedData.map(row => row['Mountyear']));
            const monthYearArray = [...monthYearSet].filter(my => my).sort((a, b) => {
              const [monthA, yearA] = a?.split('/') || ['01', '2000'];
              const [monthB, yearB] = b?.split('/') || ['01', '2000'];
              const dateA = new Date(`${yearA}-${monthA}-01`);
              const dateB = new Date(`${yearB}-${monthB}-01`);
              return dateB - dateA;
            });
            const latestMonthYear = monthYearArray[0] || '';
            setMonthYears(monthYearArray);
            setData(cleanedData);
            setSelectedMonthYear(latestMonthYear);
            setFilteredData(latestMonthYear ? cleanedData.filter(row => row['Mountyear'] === latestMonthYear) : cleanedData);
            setLoading(false);
          })
          .catch(err => {
            setError(`ไม่สามารถดึงข้อมูลจาก Google Sheet ได้: ${err.message}`);
            setLoading(false);
          });
      }, []);
      React.useEffect(() => {
        if (selectedMonthYear) {
          setFilteredData(data.filter(row => row['Mountyear'] === selectedMonthYear));
        } else {
          setFilteredData(data);
        }
      }, [selectedMonthYear, data]);
      const handleLogin = (user) => {
        if (user) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        } else {
          alert('ไม่พบผู้ใช้ในระบบ');
        }
      };
      const handleLogout = async () => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'hub:logout' }, window.location.origin);
          return;
        }
        try {
          await apiPost(API_LOGOUT_URL, {});
        } catch (err) {
          console.error('Logout failed:', err);
        }
        setIsLoggedIn(false);
        setCurrentUser(null);
      };
      const handleHistoryClick = (warehouse) => {
        setSelectedWarehouse(warehouse);
        setShowHistoryPopup(true);
      };
      const handleCloseHistoryPopup = () => {
        setShowHistoryPopup(false);
        setSelectedWarehouse('');
      };
      const handleCloseSummaryHistoryPopup = () => {
        setShowSummaryHistoryPopup(false);
      };
      const handleHamburgerClick = () => {
        setShowUserPopup(true);
      };
      const handleCloseUserPopup = () => {
        setShowUserPopup(false);
      };
      if (!isLoggedIn) {
        return <LoginForm onLogin={handleLogin} />;
      }
      if (loading) {
        return (
          <div class="flex justify-center items-center h-screen">
            <p class="text-xl text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        );
      }
      if (error) {
        return (
          <div class="flex justify-center items-center h-screen">
            <p class="text-xl text-red-600">{error}</p>
          </div>
        );
      }
      const companyData = filteredData
        .filter((item) => item['StatusSAcom'] === 'Company')
        .sort((a, b) => (b['Stock Day'] || 0) - (a['Stock Day'] || 0));
      const saData = filteredData
        .filter((item) => item['StatusSAcom'] === 'SA')
        .sort((a, b) => (b['Stock Day'] || 0) - (a['Stock Day'] || 0));
      const companyChartData = companyData.filter(item => !['นวนคร', 'คลังวัตถุดิบ'].includes(item['ชื่อคลัง']));
      const combinedChartData = [...companyChartData, ...saData];
      const totalValuebegin = filteredData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const totalValueEnd = filteredData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const totalValue = totalValueEnd;
     const getDaysInLastMonth = (monthYear) => {
  if (!monthYear) return 30;
  let [month, year] = monthYear.split('/').map(Number);
  year -= 543; // แปลงปีพ.ศ. เป็นค.ศ.
  const date = new Date(year, month, 0); // ใช้เดือนปัจจุบัน
  return date.getDate();
};
      const totalStock = filteredData.reduce((sum, item) => {
        const stockBegin = parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        const stockEnd = parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        return sum + stockEnd;
      }, 0);
      const totalEng = filteredData.reduce((sum, item) => {
        const engBegin = parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        const engEnd = parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        return sum + engEnd;
      }, 0);
      const totalCost = filteredData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
      const totalStockDay = totalCost > 0 ? Math.round(((totalValuebegin + totalValueEnd) / 2 / totalCost) * getDaysInLastMonth(selectedMonthYear)) : 0;
      const companyTotalValue = companyData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const companyTotalStock = companyData.reduce((sum, item) => {
        const stockBegin = parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        const stockEnd = parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        return sum + stockEnd;
      }, 0);
      const companyTotalEng = companyData.reduce((sum, item) => {
        const engBegin = parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        const engEnd = parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        return sum + engEnd;
      }, 0);
      const companyTotalCost = companyData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumBeginValue = companyData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumEndValue = companyData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const companyAvgStockday = companyTotalCost > 0 ? Math.round((((companySumBeginValue + companySumEndValue)/2) / companyTotalCost) * getDaysInLastMonth(selectedMonthYear)) : 0;
      const saTotalValue = saData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const saTotalStock = saData.reduce((sum, item) => {
        const stockBegin = parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        const stockEnd = parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0;
        return sum + stockEnd;
      }, 0);
      const saTotalEng = saData.reduce((sum, item) => {
        const engBegin = parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        const engEnd = parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0;
        return sum + engEnd;
      }, 0);
      const saTotalCost = saData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumBeginValue = saData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumEndValue = saData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดมูลค่ารวม']?.toString().replace(/,/g, '')) || 0), 0);
      const saAvgStockday = saTotalCost > 0 ? Math.round((((saSumEndValue + saSumBeginValue)/2) / saTotalCost) * getDaysInLastMonth(selectedMonthYear)) : 0;
      const nakhonData = companyData.find(item => item['ชื่อคลัง'] === 'นวนคร') || { 'ปลายงวดคลัง': 0 };
      const rawMaterialData = companyData.find(item => item['ชื่อคลัง'] === 'คลังวัตถุดิบ') || { 'ปลายงวดคลัง': 0 };
      const companySumBeginStock = companyData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumBeginEng = companyData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumEndStock = companyData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumEndEng = companyData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumCost = companyData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumStockDay = companySumCost > 0 ? Math.round((((companySumEndValue + companySumBeginValue)/2) / companySumCost)*getDaysInLastMonth(selectedMonthYear)) : 0;
      const saSumBeginStock = saData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดคลัง']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumBeginEng = saData.reduce((sum, item) => sum + (parseFloat(item['ต้นงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumEndStock = saData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดคลัง']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumEndEng = saData.reduce((sum, item) => sum + (parseFloat(item['ปลายงวดวิศวกรรม']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumCost = saData.reduce((sum, item) => sum + (parseFloat(item['ต้นทุนขาย']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumStockDay = saSumCost > 0 ? Math.round((((saSumEndValue + saSumBeginValue)/2) / saSumCost) * getDaysInLastMonth(selectedMonthYear)) : 0;
      const companySumStore = companyData.reduce((sum, item) => sum + (parseFloat(item['Store']?.toString().replace(/,/g, '')) || 0), 0);
      const companySumNonStore = companyData.reduce((sum, item) => sum + (parseFloat(item['NonStore']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumStore = saData.reduce((sum, item) => sum + (parseFloat(item['Store']?.toString().replace(/,/g, '')) || 0), 0);
      const saSumNonStore = saData.reduce((sum, item) => sum + (parseFloat(item['NonStore']?.toString().replace(/,/g, '')) || 0), 0);
      return (
        <ErrorBoundary>
          <div class="relative bg-white rounded-lg shadow-lg p-6">
            <button
              onClick={handleHamburgerClick}
              class="absolute top-4 right-4 text-2xl font-bold text-blue-800 no-print"
            >
              ☰
            </button>
          <h1 class="text-6xl font-bold text-center text-blue-900 mb-4 font-roboto">SPAREPART</h1>
            <h1 class="text-3xl font-bold text-center text-blue-800 mb-6">
              รายงานมูลค่า Sparepart และ Stock Day ของแต่ละศูนย์
            </h1>
            <div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-6">
              <label class="text-2xl font-bold text-blue-900">เลือกเดือน-ปี:</label>
              <div class="relative w-full max-w-[220px]">
                <select
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonthYear(e.target.value)}
                  class="w-full appearance-none bg-blue-50 border-2 border-blue-500 text-blue-900 text-2xl font-bold rounded-lg px-6 py-4 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 hover:bg-blue-100 transition-all duration-300"
                >
                  <option value="">ทั้งหมด</option>
                  {monthYears.length > 0 ? (
                    monthYears.map((my, index) => (
                      <option key={index} value={my}>{my}</option>
                    ))
                  ) : (
                    <option value="" disabled>ไม่มีข้อมูลเดือน-ปี</option>
                  )}
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
              <span class="w-[220px] text-2xl font-bold text-blue-900 bg-blue-50 border-2 border-blue-500 px-4 py-4 rounded-lg shadow-md">เป้าหมาย 180 วัน</span>
              <button
                onClick={() => setShowSummaryHistoryPopup(true)}
                class="w-[220px] text-2xl font-bold text-white bg-blue-500 border-2 border-blue-700 px-4 py-4 rounded-lg shadow-md hover:bg-blue-600 transition-all duration-300"
              >
                ผลดำเนินการ
              </button>
            </div>
            <div class="mb-8">
              <h2 class="text-2xl font-semibold text-blue-800 mb-4 tracking-wide leading-relaxed shadow-md">รายงานมูลค่า SPAREPART ทั้งหมด</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div class="bg-blue-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-blue-900">มูลค่าทั้งหมด</h2>
                   <p class="text-2xl font-bold text-blue-700">{formatNumber(totalValue)} บาท</p>
                </div>
                <div class="bg-green-200 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-green-900">มูลค่าคลังรวม</h2>
                   <p class="text-2xl font-bold text-green-700">{formatNumber(totalStock)} บาท</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">มูลค่ารวมวิศวกรรม</h2>
                  <p class="text-2xl font-bold text-purple-600">{formatNumber(totalEng)} บาท</p>
                </div>
                <div class="bg-orange-100 p-4 rounded-lg shadow">
                  <h2 class="text-base font-semibold text-orange-800">ต้นทุนขาย</h2>
                  <p class="text-2xl font-bold text-orange-600">{formatNumber(totalCost)} บาท</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">Stock Day รวม</h2>
                  <p class="text-2xl font-bold text-purple-600">{totalStockDay} วัน</p>
                </div>
              </div>
            </div>
            <div class="mb-12">
              <h2 class="text-2xl font-semibold text-blue-800 mb-4 tracking-wide leading-relaxed shadow-md">รายงานมูลค่า SPAREPART รวม Company และ SA</h2>
              <div class="w-full h-[500px]">
                <Recharts.ResponsiveContainer width="100%" height="100%">
                  <Recharts.ComposedChart data={combinedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" />
                    <Recharts.XAxis
                      dataKey="ชื่อคลัง"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Recharts.YAxis
                      yAxisId="left"
                      label={{ value: 'มูลค่า (บาท)', angle: -90, position: 'insideLeft', offset: -10 }}
                      tickFormatter={formatNumber}
                      tick={{ fontSize: 12 }}
                    />
                    <Recharts.YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'Stock Day (วัน)', angle: 90, position: 'insideRight', offset: -10 }}
                      tick={{ fontSize: 12 }}
                    />
                    <Recharts.Tooltip content={<CustomTooltip />} />
                    <Recharts.Legend verticalAlign="top" height={36} />
                    <Recharts.Bar
                      yAxisId="left"
                      dataKey="มูลค่าคลัง"
                      name="คลัง"
                      stackId="a"
                      fill="#15803D"
                      barSize={20}
                      unit="บาท"
                    />
                    <Recharts.Bar
                      yAxisId="left"
                      dataKey="มูลค่าวิศวกรรม"
                      name="วิศวกรรม"
                      stackId="a"
                      fill="#6B21A8"
                      barSize={20}
                      unit="บาท"
                    >
                      <Recharts.LabelList
                        dataKey="ปลายงวดมูลค่ารวม"
                        position="top"
                        formatter={formatNumber}
                        style={{ fontSize: 12, fill: '#f1f5f9', fontWeight: 'bold' }}
                      />
                    </Recharts.Bar>
                    <Recharts.Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Stock Day"
                      name="Stock Day"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      unit="วัน"
                    >
                      <Recharts.LabelList
                        dataKey="Stock Day"
                        position="top"
                        formatter={(value) => `${Math.round(value)} วัน`}
                        style={{ fontSize: 12, fill: '#fbbf24', fontWeight: 'bold' }}
                      />
                    </Recharts.Line>
                    <Recharts.ReferenceLine
                      yAxisId="right"
                      y={180}
                      label={{ value: 'เป้าหมาย 180 วัน', position: 'insideTop', fill: '#fca5a5', fontSize: 13, fontWeight: 'bold' }}
                      stroke="#f87171"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                    />
                  </Recharts.ComposedChart>
                </Recharts.ResponsiveContainer>
              </div>
            </div>
            <div class="mb-12">
            <h2 class="text-2xl font-semibold text-blue-800 mb-4 tracking-wide leading-relaxed shadow-md">รายงานมูลค่า SPAREPART ศูนย์ Company</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div class="bg-blue-100 p-4 rounded-lg shadow">
  <h2 class="text-lg font-semibold text-blue-900">มูลค่าทั้งหมด (Company)</h2>
  <p class="text-2xl font-bold text-blue-700">{formatNumber(companyTotalValue)} บาท</p>
</div>
                <div class="bg-green-200 p-4 rounded-lg shadow">
  <h2 class="text-lg font-semibold text-green-900">มูลค่าคลังรวม (Company)</h2>
  <p class="text-2xl font-bold text-green-700">{formatNumber(companyTotalStock)} บาท</p>
</div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">มูลค่ารวมวิศวกรรม (Company)</h2>
                  <p class="text-2xl font-bold text-purple-600">{formatNumber(companyTotalEng)} บาท</p>
                </div>
                <div class="bg-orange-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-orange-800">ต้นทุนขาย (Company)</h2>
                  <p class="text-2xl font-bold text-orange-600">{formatNumber(companyTotalCost)} บาท</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">Stock Day รวม (Company)</h2>
                  <p class="text-2xl font-bold text-purple-600">{companyAvgStockday} วัน</p>
                </div>
              </div>
              <div class="flex flex-wrap gap-4 mb-6">
                <div class="bg-yellow-100 p-4 rounded-lg shadow flex-1 min-w-[200px]">
                  <h3 class="text-lg font-semibold text-yellow-800">นวนคร มูลค่าคลัง</h3>
                  <p class="text-2xl font-bold text-yellow-600">{formatNumber(nakhonData['ปลายงวดคลัง'])} บาท</p>
                </div>
                <div class="bg-yellow-100 p-4 rounded-lg shadow flex-1 min-w-[200px]">
                  <h3 class="text-lg font-semibold text-yellow-800">คลังวัตถุดิบ มูลค่าคลัง</h3>
                  <p class="text-2xl font-bold text-yellow-600">{formatNumber(rawMaterialData['ปลายงวดคลัง'])} บาท</p>
                </div>
              </div>
            </div>
            <div class="mb-12">
              <h2 class="text-2xl font-semibold text-blue-800 mb-4 tracking-wide leading-relaxed shadow-md">รายงานมูลค่า SPAREPART ศูนย์ SA</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div class="bg-blue-100 p-4 rounded-lg shadow">
                <h2 class="text-lg font-semibold text-blue-900">มูลค่าทั้งหมด (SA)</h2>
                  <p class="text-2xl font-bold text-blue-700">{formatNumber(saTotalValue)} บาท</p>
                </div>
                <div class="bg-green-200 p-4 rounded-lg shadow">
                <h2 class="text-lg font-semibold text-green-900">มูลค่าคลังรวม (SA)</h2>
                  <p class="text-2xl font-bold text-green-700">{formatNumber(saTotalStock)} บาท</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">มูลค่ารวมวิศวกรรม (SA)</h2>
                  <p class="text-2xl font-bold text-purple-600">{formatNumber(saTotalEng)} บาท</p>
                </div>
                <div class="bg-orange-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-orange-800">ต้นทุนขาย (SA)</h2>
                  <p class="text-2xl font-bold text-orange-600">{formatNumber(saTotalCost)} บาท</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg shadow">
                  <h2 class="text-lg font-semibold text-purple-800">Stock Day รวม (SA)</h2>
                  <p class="text-2xl font-bold text-purple-600">{saAvgStockday} วัน</p>
                </div>
              </div>
            </div>
            <SevenElevenChart selectedMonthYear={selectedMonthYear} />
            <div class="mb-12">
              <h2 class="text-2xl font-semibold text-blue-800 mb-4">
                รายงานข้อมูล Sparepart ศูนย์ Company ({selectedMonthYear || 'ทุกเดือน'})
              </h2>
              <div class="overflow-x-auto">
                <table class="w-full bg-white shadow-sm border-collapse">
                  <thead>
                    <tr class="bg-blue-900">
                     <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500 text-blue-900">ศูนย์</th>
                     <th colspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">สาขา</th>
                      <th colspan="3" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ต้นงวด</th>
                      <th colspan="3" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ปลายงวด</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ต้นทุนขาย</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">Stock Day</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">History</th>
                    </tr>
                    <tr class="bg-blue-900">
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">7-11</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">Non 7-11</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">คลัง</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">วิศวกรรม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">มูลค่ารวม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">คลัง</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">วิศวกรรม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">มูลค่ารวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyData.length > 0 ? (
                      companyData.map((item, index) => (
                        <tr key={index} class={`transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td
    class="p-2 text-center font-bold text-blue-900 border border-gray-300 cursor-pointer"
    onClick={() => handleHistoryClick(item['ชื่อคลัง'])}
  >
    {item['ชื่อคลัง']}
  </td>
                          <td class="border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm">{item['Store']}</td>
                          <td class="border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm">{item['NonStore']}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดคลัง'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดวิศวกรรม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดมูลค่ารวม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดคลัง'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดวิศวกรรม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดมูลค่ารวม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นทุนขาย'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : 'bg-green-100'}`}>
                            {Math.round(item['Stock Day'] || 0) === 0 ? 'On Process' : Math.round(item['Stock Day'] || 0)}
                          </td>
                          <td class={`border border-gray-300 p-2 text-center ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>
                            <button
                              onClick={() => handleHistoryClick(item['ชื่อคลัง'])}
                              class="bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors duration-200"
                            >
                              ผลดำเนินการ
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colspan="12" class="border border-gray-300 p-4 text-center text-gray-600 font-medium text-base">
                          ไม่มีข้อมูล Company สำหรับ {selectedMonthYear || 'ทุกเดือน'}
                        </td>
                      </tr>
                    )}
                    {companyData.length > 0 && (
                      <tr class="bg-blue-100 font-bold transition-colors duration-200">
                        <td class="border border-gray-300 p-2 text-center text-blue-900 text-base bg-blue-100">ผลรวม</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{companySumStore}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{companySumNonStore}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumBeginStock)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumBeginEng)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumBeginValue)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumEndStock)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumEndEng)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumEndValue)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(companySumCost)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{Math.round(companySumStockDay)}</td>
                        <td class="border border-gray-300 p-2 text-center text-blue-900 text-base">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mb-12">
              <h2 class="text-2xl font-semibold text-green-800 mb-4">
                รายงานข้อมูล Sparepart ศูนย์ SA ({selectedMonthYear || 'ทุกเดือน'})
              </h2>
              <div class="overflow-x-auto">
                <table class="w-full bg-white shadow-sm border-collapse">
                  <thead>
                    <tr class="bg-blue-900">
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500 text-blue-900">ศูนย์</th>
                      <th colspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">สาขา</th>
                      <th colspan="3" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ต้นงวด</th>
                      <th colspan="3" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ปลายงวด</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">ต้นทุนขาย</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">Stock Day</th>
                      <th rowspan="2" class="p-2 text-center font-bold text-white text-base border border-gray-300 border-b-2 border-blue-500">History</th>
                    </tr>
                    <tr class="bg-blue-900">
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">7-11</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">Non 7-11</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">คลัง</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">วิศวกรรม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">มูลค่ารวม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">คลัง</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">วิศวกรรม</th>
                      <th class="p-2 text-center font-bold text-white text-base border border-gray-300 border-t border-blue-500">มูลค่ารวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saData.length > 0 ? (
                      saData.map((item, index) => (
                        <tr key={index} class={`transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                         <td
                          class="p-2 text-center font-bold text-blue-900 border border-gray-300 cursor-pointer"
                          onClick={() => handleHistoryClick(item['ชื่อคลัง'])}
                              >
                            {item['ชื่อคลัง']}
                        </td>
                          <td class="border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm">{item['Store']}</td>
                          <td class="border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm">{item['NonStore']}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดคลัง'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดวิศวกรรม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นงวดมูลค่ารวม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดคลัง'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดวิศวกรรม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ปลายงวดมูลค่ารวม'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>{formatNumber(item['ต้นทุนขาย'])}</td>
                          <td class={`border border-gray-300 p-2 text-right text-gray-900 font-medium text-sm ${Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : 'bg-green-100'}`}>
                            {Math.round(item['Stock Day'] || 0) === 0 ? 'On Process' : Math.round(item['Stock Day'] || 0)}
                          </td>
                          <td class={`border border-gray-300 p-2 text-center ${Math.round(item['Stock Day'] || 0) > 180 ? 'bg-red-100' : Math.round(item['Stock Day'] || 0) === 0 ? 'bg-gray-200' : 'bg-green-100'}`}>
                            <button
                              onClick={() => handleHistoryClick(item['ชื่อคลัง'])}
                              class="bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors duration-200"
                            >
                              ผลดำเนินการ
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colspan="12" class="border border-gray-300 p-4 text-center text-gray-600 font-medium text-base">
                          ไม่มีข้อมูล SA สำหรับ {selectedMonthYear || 'ทุกเดือน'}
                        </td>
                      </tr>
                    )}
                    {saData.length > 0 && (
                      <tr class="bg-blue-100 font-bold transition-colors duration-200">
                        <td class="border border-gray-300 p-2 text-center text-blue-900 text-base bg-blue-100">ผลรวม</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{saSumStore}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{saSumNonStore}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumBeginStock)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumBeginEng)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumBeginValue)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumEndStock)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumEndEng)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumEndValue)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{formatNumber(saSumCost)}</td>
                        <td class="border border-gray-300 p-2 text-right text-blue-900 text-base">{Math.round(saSumStockDay)}</td>
                        <td class="border border-gray-300 p-2 text-center text-blue-900 text-base">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <HistoryPopup
              isOpen={showHistoryPopup}
              onClose={handleCloseHistoryPopup}
              warehouse={selectedWarehouse}
              data={data}
            />
            <SummaryHistoryPopup
              isOpen={showSummaryHistoryPopup}
              onClose={handleCloseSummaryHistoryPopup}
              data={data}
            />
            <UserPopup
              isOpen={showUserPopup}
              onClose={handleCloseUserPopup}
              user={currentUser}
              handleLogout={handleLogout}
            />
          </div>
        </ErrorBoundary>
      );
    };
    ReactDOM.render(<App />, document.getElementById('root'));
  

