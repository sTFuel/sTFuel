'use client';
import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_HOURLY_SNAPSHOTS, GET_DAILY_SNAPSHOTS, GET_EDGE_NODES, GET_USERS } from '@/graphql/queries';
import StatsCard from '@/components/StatsCard';
import { formatTFuel, formatTFuelBigInt, formatNumber, formatAddress, formatDate, parseTimestamp, calculateNetStaked } from '@/lib/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAPR } from '@/hooks/useAPR';
import { useBlockchainData } from '@/hooks/useBlockchainData';

type TabType = 'general' | 'edgenodes' | 'users';

export default function Stats() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [selectedMetric, setSelectedMetric] = useState('stfuelRate');
  const [dateRange, setDateRange] = useState('7d');

  // Use the APR hook
  const { apr, loading: aprLoading, error: aprError, dataPoints, timeRange } = useAPR();

  // Use blockchain data hook for real-time on-chain data
  const { data: blockchainData, loading: blockchainLoading, error: blockchainError } = useBlockchainData();

  // Stable query variables to prevent unnecessary re-renders
  const edgeNodesVariablesRef = useRef({ first: 50 });
  const usersVariablesRef = useRef({ first: 100, minBalance: '1000000000000000000' });
  
  // Create stable variables for snapshots based on date range
  const snapshotVariables = useMemo(() => {
    const fromDate = getDateRangeStartWithBuffer(dateRange);
    // Use current UTC time for backend query
    const toDate = new Date().toISOString();
    
    // Calculate how many data points we need based on time range
    const timeDiffMs = new Date(toDate).getTime() - new Date(fromDate).getTime();
    const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24);
    
    // Determine appropriate request size based on time range
    let first = 200;
    if (daysDiff <= 1) {
      first = 30; // 24 hours = 24 hours, request 30 to ensure we get all hourly data
    } else if (daysDiff <= 7) {
      first = 200; // 7 days = ~168 hours, request 200 to ensure we get all hourly data
    } else if (daysDiff <= 30) {
      first = 1000; // 30 days = ~720 hours, request 1000 to ensure we get all hourly data
    } else if (daysDiff <= 90) {
      first = 100; // 90 days, use daily snapshots - request 100 days
    } else {
      first = 400; // 1 year, use daily snapshots - request 400 days to cover full year
    }
    
    return {
      first,
      fromDate,
      toDate,
      useDaily: daysDiff > 30, // Use daily snapshots for 90+ day ranges
    };
  }, [dateRange]);

  // Use appropriate query based on time range
  const { data: hourlyData, loading: hourlyLoading } = useQuery(
    snapshotVariables.useDaily ? GET_DAILY_SNAPSHOTS : GET_HOURLY_SNAPSHOTS,
    {
      variables: {
        first: snapshotVariables.first,
        fromDate: snapshotVariables.fromDate,
        toDate: snapshotVariables.toDate,
      },
      fetchPolicy: 'network-only', // Always fetch fresh data when variables change
      notifyOnNetworkStatusChange: true,
      skip: false, // Always execute the query
    }
  );
  const { data: edgeNodesData, loading: edgeNodesLoading } = useQuery(GET_EDGE_NODES, {
    variables: edgeNodesVariablesRef.current,
    fetchPolicy: 'cache-first',
  });
  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS, {
    variables: usersVariablesRef.current,
    fetchPolicy: 'cache-first'
  });

  // Get snapshots from the appropriate data source
  const snapshots = snapshotVariables.useDaily 
    ? (hourlyData as any)?.dailySnapshots?.edges?.map((edge: any) => edge.node) || []
    : (hourlyData as any)?.hourlySnapshots?.edges?.map((edge: any) => edge.node) || [];
  
  // Filter edge nodes: show if net staked > 0 OR (isLive and isActive)
  const edgeNodes = useMemo(() => {
    const allNodes = (edgeNodesData as any)?.edgeNodes?.edges?.map((edge: any) => edge.node) || [];
    return allNodes.filter((node: any) => {
      const netStaked = calculateNetStaked(node.totalStaked, node.totalUnstaked);
      const hasStaked = BigInt(netStaked) > BigInt(0);
      const isRunningAndActive = node.isLive === true && node.isActive === true;
      return hasStaked || isRunningAndActive;
    });
  }, [edgeNodesData]);
  const users = (usersData as any)?.users?.edges?.map((edge: any) => edge.node) || [];

  // Process chart data
  const chartData = useMemo(() => {
    if (!snapshots.length) return [];
    
    // Calculate time range to determine filtering strategy
    const timeDiffMs = new Date().getTime() - new Date(getDateRangeStart(dateRange)).getTime();
    const daysDiff = timeDiffMs / (1000 * 60 * 60 * 24);
    
    // Process all snapshots first
    const processedSnapshots = snapshots
      .map((snapshot: any) => {
        const stfuelRate = calculateExchangeRate(snapshot.tfuelBackingAmount, snapshot.stfuelTotalSupply);
        const timestamp = parseTimestamp(snapshot.snapshotTimestamp);
        const date = new Date(timestamp);
        
        // Create local date for display purposes
        const localDate = new Date(timestamp);
        
        return {
          timestamp,
          // Display date in user's local timezone
          date: localDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          }),
          fullDate: date.toISOString(),
          localDate: localDate.toISOString(),
          timeValue: timestamp,
          stfuelRate: Number(stfuelRate.toFixed(6)),
          tfuelBacking: parseFloat(formatTFuelBigInt(snapshot.tfuelBackingAmount)),
          stakedTFuel: parseFloat(formatTFuelBigInt(snapshot.tfuelStakedAmount)),
          holdersCount: Number(snapshot.currentHoldersCount) || 0,
          referralRewards: parseFloat(formatTFuelBigInt(snapshot.totalReferralRewards)),
          edgeNodesCount: Number(snapshot.edgeNodesCount) || 0,
          hour: localDate.getHours(), // Use local time for deduplication logic
          day: localDate.toISOString().split('T')[0], // YYYY-MM-DD format in local time
          dayKey: localDate.toISOString().split('T')[0], // YYYY-MM-DD format in local time
          // Store raw values for APR calculation
          rawStfuelRate: stfuelRate,
          // Timezone information
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcOffset: localDate.getTimezoneOffset(),
        };
      })
      .sort((a: any, b: any) => a.timestamp - b.timestamp);

    // Calculate APR for each data point using the previous snapshot
    const snapshotsWithAPR = processedSnapshots.map((snapshot: any, index: number) => {
      if (index === 0) {
        return {
          ...snapshot,
          apr: 0, // Very first snapshot in the entire dataset has no previous data
        };
      }

      const previousSnapshot = processedSnapshots[index - 1];
      const timeDiffHours = (snapshot.timestamp - previousSnapshot.timestamp) / (1000 * 60 * 60);
      
      if (timeDiffHours <= 0 || previousSnapshot.rawStfuelRate === 0) {
        return {
          ...snapshot,
          apr: 0,
        };
      }

      // Calculate APR: ((current_rate / previous_rate) - 1) * (365 * 24 / hours_diff) * 100
      const rateChange = (snapshot.rawStfuelRate / previousSnapshot.rawStfuelRate) - 1;
      const annualizedRate = rateChange * (365 * 24 / timeDiffHours) * 100;
      
      return {
        ...snapshot,
        apr: Number(annualizedRate.toFixed(2)),
      };
    });
    
    // Apply filtering based on time range
    if (snapshotVariables.useDaily) {
      // For daily snapshots (90+ days), filter to only show the original time range
      const originalStart = new Date(getDateRangeStart(dateRange)).getTime();
      return snapshotsWithAPR.filter((snapshot: any) => snapshot.timestamp >= originalStart);
    } else if (daysDiff <= 1) {
      // For 24 hours, filter to only show the original 24h range and apply hourly deduplication
      const originalStart = new Date(getDateRangeStart(dateRange)).getTime();
      const filteredSnapshots = snapshotsWithAPR.filter((snapshot: any) => snapshot.timestamp >= originalStart);
      
      const hourlyData = new Map();
      filteredSnapshots.forEach((snapshot: any) => {
        const hourKey = `${snapshot.day}-${snapshot.hour}`;
        if (!hourlyData.has(hourKey)) {
          hourlyData.set(hourKey, snapshot);
        }
      });
      return Array.from(hourlyData.values());
    } else {
      // For hourly snapshots (7-30 days), filter to one snapshot per hour and original time range
      const originalStart = new Date(getDateRangeStart(dateRange)).getTime();
      const filteredSnapshots = snapshotsWithAPR.filter((snapshot: any) => snapshot.timestamp >= originalStart);
      
      const hourlyData = new Map();
      filteredSnapshots.forEach((snapshot: any) => {
        const hourKey = `${snapshot.day}-${snapshot.hour}`;
        if (!hourlyData.has(hourKey)) {
          hourlyData.set(hourKey, snapshot);
        }
      });
      return Array.from(hourlyData.values());
    }
  }, [snapshots, dateRange, snapshotVariables.useDaily]);

  const metricOptions = [
    { value: 'stfuelRate', label: 'sTFuel/TFuel Rate' },
    { value: 'tfuelBacking', label: 'TFuel Backing' },
    { value: 'stakedTFuel', label: 'Staked TFuel' },
    { value: 'holdersCount', label: 'Holders Count' },
    { value: 'referralRewards', label: 'Referral Rewards' },
    { value: 'edgeNodesCount', label: 'EdgeNodes Count' },
    { value: 'apr', label: 'Approx. APR' },
  ];

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'edgenodes', label: 'EdgeNodes' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Stats Overview */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
                label="sTFuel Total Supply"
                value={blockchainLoading ? 'Loading...' : formatNumber(parseFloat(formatTFuelBigInt(blockchainData.totalSupply)))}
                color="theta"
                subtitle={blockchainLoading ? 'Get real-time data...' : 'Real-time on-chain data'}
            />
            <StatsCard
                label="Total TFuel Backing"
                value={blockchainLoading ? 'Loading...' : formatNumber(parseFloat(formatTFuelBigInt(blockchainData.netAssetsBackingShares)))}
                color="tfuel"
                subtitle={blockchainLoading ? 'Get real-time data...' : 'Real-time on-chain data'}
            />
            <StatsCard
                label="TFuel Staked %"
                value={blockchainLoading ? 'Loading...' : `${((parseFloat(blockchainData.totalStakedTFuel) / parseFloat(blockchainData.netAssetsBackingShares)) * 100).toFixed(1)}%`}
                color="theta"
                subtitle={blockchainLoading ? 'Get real-time data...' : 'Real-time on-chain data'}
            />
            <StatsCard
                label="Total TFuel Staked"
                value={blockchainLoading ? 'Loading...' : formatNumber(parseFloat(formatTFuelBigInt(blockchainData.totalStakedTFuel)))}
                color="tfuel"
                subtitle={blockchainLoading ? 'Get real-time data...' : 'Real-time on-chain data'}
            />
            <StatsCard
                label="Approx. APR"
                value={aprLoading ? 'Loading...' : `${formatNumber(apr)}%`}
                color="secondary"
                subtitle={aprLoading ? 'Get APR...' : `Based on historical data`}
            />
            <StatsCard
                label="Exchange Rate"
                value={blockchainLoading ? 'Loading...' : `${blockchainData.exchangeRate.toFixed(4)}`}
                subtitle={blockchainLoading ? 'Get real-time data...' : 'sTFuel per TFuel'}
                color="theta"
            />
            <StatsCard
                label="Active EdgeNodes"
                value={blockchainLoading ? 'Loading...' : formatNumber(blockchainData.usedNodes)}
                color="secondary"
                subtitle={blockchainLoading ? 'Get real-time data...' : 'Real-time on-chain data'}
            />
            <StatsCard
                label="Holders"
                value={blockchainLoading ? 'Loading...' : `${chartData[chartData.length - 1]?.holdersCount || 0}`}
                subtitle={blockchainLoading ? 'Get holders count...' : 'Based on last snapshot'}
                color="theta"
            />
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="border-b border-border-dark/50">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-tfuel text-tfuel-color'
                    : 'border-transparent text-text-secondary-dark hover:text-tfuel-color hover:border-tfuel/50'
                } hover:cursor-pointer`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Tab Content */}
      <section>
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Chart Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-4">
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white focus:border-tfuel focus:outline-none hover:cursor-pointer"
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white focus:border-tfuel focus:outline-none pl-8 hover:cursor-pointer"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {metricOptions.find(m => m.value === selectedMetric)?.label} Over Time
                {hourlyLoading && (
                  <span className="ml-2 text-sm text-text-secondary-dark">(Loading...)</span>
                )}
                <div className="text-sm font-normal text-text-secondary-dark mt-1">
                  Times displayed in {Intl.DateTimeFormat().resolvedOptions().timeZone} timezone
                </div>
              </h3>
              <div className="h-80">
                {hourlyLoading ? (
                  <div className="flex items-center justify-center h-full text-text-secondary-dark">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tfuel-color"></div>
                      Loading chart data...
                    </div>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-secondary-dark">
                    No data available for the selected time range
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#325567" />
                      <XAxis 
                        dataKey="timeValue" 
                        type="number"
                        scale="time"
                        domain={getFixedDomain(dateRange)}
                        stroke="#A0A0B0"
                        fontSize={12}
                        tick={{ fill: '#A0A0B0' }}
                        ticks={generateFixedTicks(dateRange)}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          
                          switch (dateRange) {
                            case '24h':
                              // For 24 hours: show time labels in local timezone
                              return date.toLocaleTimeString('en-US', { 
                                hour: 'numeric',
                                hour12: true,
                                timeZoneName: 'short'
                              });
                            case '7d':
                              // For 7 days: show daily labels in local timezone
                              return date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              });
                            case '30d':
                              // For 30 days: show every 2 days in local timezone
                              const dayOfMonth30 = date.getDate();
                              return dayOfMonth30 % 2 === 0 ? date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              }) : '';
                            case '90d':
                              // For 90 days: show every 6 days in local timezone
                              const dayOfMonth90 = date.getDate();
                              return dayOfMonth90 % 6 === 0 ? date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              }) : '';
                            case '1y':
                              // For 1 year: show monthly labels in local timezone
                              return date.getDate() === 1 ? date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                year: '2-digit'
                              }) : '';
                            default:
                              return date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              });
                          }
                        }}
                        interval={0} // Let tickFormatter control which labels to show
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        stroke="#A0A0B0"
                        fontSize={12}
                        tick={{ fill: '#A0A0B0' }}
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => {
                          if (selectedMetric === 'stfuelRate') {
                            return value.toFixed(4);
                          } else if (selectedMetric === 'apr') {
                            return `${value.toFixed(1)}%`;
                          } else if (selectedMetric === 'holdersCount' || selectedMetric === 'edgeNodesCount') {
                            return value.toLocaleString();
                          } else {
                            return formatNumber(value);
                          }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1A1A22',
                          border: '1px solid #325567',
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            const data = payload[0].payload;
                            const localDate = new Date(data.timestamp);
                            return `${localDate.toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              timeZoneName: 'short'
                            })} (${data.timezone})`;
                          }
                          return label;
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'stfuelRate') {
                            return [Number(value).toFixed(6), 'Exchange Rate'];
                          } else if (name === 'apr') {
                            return [`${Number(value).toFixed(2)}%`, 'APR'];
                          } else if (name === 'holdersCount' || name === 'edgeNodesCount') {
                            return [Number(value).toLocaleString(), metricOptions.find(m => m.value === name)?.label];
                          } else {
                            return [formatNumber(Number(value)), metricOptions.find(m => m.value === name)?.label];
                          }
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey={selectedMetric} 
                        stroke="#ec8853" 
                        strokeWidth={2}
                        dot={{ fill: '#ec8853', strokeWidth: 2, r: 3 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'edgenodes' && (
          <div className="bg-card-dark border border-border-dark/50 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-dark/50">
              <h3 className="text-lg font-semibold text-white">EdgeNodes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Total Staked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Node Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Is Live
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {edgeNodesLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-text-secondary-dark">
                        Loading...
                      </td>
                    </tr>
                  ) : edgeNodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-text-secondary-dark">
                        No edge nodes found
                      </td>
                    </tr>
                  ) : (
                    edgeNodes.map((node: any) => (
                      <tr key={node.id} className="hover:bg-background-dark/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                          {formatAddress(node.address.address)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            node.unstakeBlock 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : node.isActive 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                          }`}>
                            {node.unstakeBlock ? 'Unstaking' : node.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatTFuelBigInt(calculateNetStaked(node.totalStaked, node.totalUnstaked))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-dark">
                          {node.nodeType || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            node.isLive 
                              ? 'bg-blue-500/20 text-blue-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {node.isLive ? 'Live' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-card-dark border border-border-dark/50 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-dark/50">
              <h3 className="text-lg font-semibold text-white">Top Holders</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      sTFuel Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Total Deposited
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Total Withdrawn
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-text-secondary-dark">
                        Loading...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-text-secondary-dark">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user: any) => (
                      <tr key={user.id} className="hover:bg-background-dark/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                          {formatAddress(user.address.address)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatTFuelBigInt(user.stfuelBalance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-dark">
                          {formatTFuelBigInt(user.totalDeposited)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-dark">
                          {formatTFuelBigInt(user.totalWithdrawn)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Helper functions
function getDateRangeStart(range: string): string {
    const now = new Date();
    switch (range) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  function getDateRangeStartWithBuffer(range: string): string {
    const now = new Date();
    let startTime;
    switch (range) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
        break;
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
        break;
      case '1y':
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);
    }
    // Return UTC time for backend query
    return startTime.toISOString();
  }

function getFixedDomain(dateRange: string): [number, number] {
  const now = new Date();
  const endTime = now.getTime();
  
  switch (dateRange) {
    case '24h':
      return [endTime - 24 * 60 * 60 * 1000, endTime];
    case '7d':
      return [endTime - 7 * 24 * 60 * 60 * 1000, endTime];
    case '30d':
      return [endTime - 30 * 24 * 60 * 60 * 1000, endTime];
    case '90d':
      return [endTime - 90 * 24 * 60 * 60 * 1000, endTime];
    case '1y':
      return [endTime - 365 * 24 * 60 * 60 * 1000, endTime];
    default:
      return [endTime - 7 * 24 * 60 * 60 * 1000, endTime];
  }
}

function generateFixedTicks(dateRange: string): number[] {
  const now = new Date();
  const ticks: number[] = [];
  
  switch (dateRange) {
    case '24h':
      // Every 4 hours for 24 hours
      for (let i = 24; i >= 0; i -= 4) {
        const date = new Date(now.getTime() - i * 60 * 60 * 1000);
        ticks.push(date.getTime());
      }
      break;
      
    case '7d':
      // Every day at 12pm for 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        date.setHours(12, 0, 0, 0); // Set to 12pm
        ticks.push(date.getTime());
      }
      break;
      
    case '30d':
      // Every 2 days at 12pm for 30 days
      for (let i = 30; i >= 0; i -= 2) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        date.setHours(12, 0, 0, 0); // Set to 12pm
        ticks.push(date.getTime());
      }
      break;
      
    case '90d':
      // Every 6 days at 12pm for 90 days
      for (let i = 90; i >= 0; i -= 6) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        date.setHours(12, 0, 0, 0); // Set to 12pm
        ticks.push(date.getTime());
      }
      break;
      
    case '1y':
      // Every month at 12pm for 1 year
      for (let i = 12; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1, 12, 0, 0, 0);
        ticks.push(date.getTime());
      }
      break;
  }
  
  return ticks.sort((a, b) => a - b);
}


function calculateExchangeRate(tfuelBacking: string, stfuelSupply: string): number {
  try {
    const backing = parseFloat(tfuelBacking);
    const supply = parseFloat(stfuelSupply);
    return supply === 0 ? 0.1 : backing / supply;
  } catch {
    return 0.1;
  }
}
