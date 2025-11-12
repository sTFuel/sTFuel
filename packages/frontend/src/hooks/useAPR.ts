'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import { ethers } from 'ethers';
import { GET_EDGE_NODES, GET_DAILY_SNAPSHOTS } from '@/graphql/queries';

interface HourlySnapshot {
  id: string;
  snapshotTimestamp: string | number;
  tfuelBackingAmount: string;
  stfuelTotalSupply: string;
  createdAt: string;
}

interface UseAPRResult {
  apr: number;
  loading: boolean;
  error: string | null;
  dataPoints: number;
  timeRange: string;
}

export const useAPR = (): UseAPRResult => {
  const [apr, setApr] = useState<number>(0);
  const [dataPoints, setDataPoints] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<string>('');

  // Stable query variables
  const variablesRef = useRef<{ first: number; fromDate: string; toDate: string } | null>(null);
  if (!variablesRef.current) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    variablesRef.current = {
      first: 365,
      fromDate: oneYearAgo.toISOString(),
      toDate: now.toISOString(),
    };
  }

  const { data: dailyData, loading: dailyLoading, error: dailyError } = useQuery(GET_DAILY_SNAPSHOTS, {
    variables: variablesRef.current!,
    fetchPolicy: 'network-only',
  });

  const calculatedAPR = useMemo(() => {
    try {
      if (!(dailyData as any)?.dailySnapshots?.edges?.length) {
        return { apr: 0, dataPoints: 0, timeRange: 'No data' };
      }

      const rawSnapshots = (dailyData as any)?.dailySnapshots?.edges.map((edge: any) => edge.node);

      const snapshots: HourlySnapshot[] = rawSnapshots
        .filter(
          (s: HourlySnapshot) =>
            s?.stfuelTotalSupply !== '0' && s?.tfuelBackingAmount !== '0'
        )
        .sort(
          (a: HourlySnapshot, b: HourlySnapshot) =>
            new Date(a.snapshotTimestamp).getTime() - new Date(b.snapshotTimestamp).getTime()
        );

      if (snapshots.length < 2) {
        return { apr: 0, dataPoints: snapshots.length, timeRange: 'Insufficient data' };
      }

      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];

      // Parse the raw BigInt strings directly using ethers
      const firstBacking = parseFloat(ethers.formatUnits(first.tfuelBackingAmount, 18));
      const lastBacking = parseFloat(ethers.formatUnits(last.tfuelBackingAmount, 18));
      const firstSupply = parseFloat(ethers.formatUnits(first.stfuelTotalSupply, 18));
      const lastSupply = parseFloat(ethers.formatUnits(last.stfuelTotalSupply, 18));

      if (firstBacking === 0 || firstSupply === 0) {
        return { apr: 0, dataPoints: snapshots.length, timeRange: 'Invalid data' };
      }

      const firstDate = new Date(first.snapshotTimestamp);
      const lastDate = new Date(last.snapshotTimestamp);
      const timeDiffMs = lastDate.getTime() - firstDate.getTime();
      const timeDiffYears = timeDiffMs / (1000 * 60 * 60 * 24 * 365.25);

      if (timeDiffYears <= 0) {
        return { apr: 0, dataPoints: snapshots.length, timeRange: 'Invalid time range' };
      }

      // Calculate APR based on exchange rate growth (backing/supply ratio)
      const firstExchangeRate = firstBacking / firstSupply;
      const lastExchangeRate = lastBacking / lastSupply;
      const growth = (lastExchangeRate - firstExchangeRate) / firstExchangeRate;
      const aprValue = (growth / timeDiffYears) * 100;

      const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
      const timeRangeStr =
        daysDiff < 30
          ? `${daysDiff} days`
          : daysDiff < 365
          ? `${Math.floor(daysDiff / 30)} months`
          : `${Math.floor(daysDiff / 365)} years`;

      return {
        apr: Math.max(0, aprValue),
        dataPoints: snapshots.length,
        timeRange: timeRangeStr,
      };
    } catch (err) {
      console.error('APR calculation error:', err);
      return { apr: 0, dataPoints: 0, timeRange: 'Error' };
    }
  }, [dailyData]);

  useEffect(() => {
    setApr(calculatedAPR.apr);
    setDataPoints(calculatedAPR.dataPoints);
    setTimeRange(calculatedAPR.timeRange);
  }, [calculatedAPR]);

  return {
    apr,
    loading: dailyLoading,
    error: dailyError?.message || null,
    dataPoints,
    timeRange,
  };
};