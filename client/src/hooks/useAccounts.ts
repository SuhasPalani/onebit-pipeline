import { useState, useEffect } from 'react'
import api from '../services/api'

export function useAccounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAccounts = async () => {
  try {
    setLoading(true);
    const response = await api.get('/accounts');

    // 👇 Make sure we only accept arrays
    const data = Array.isArray(response.data) ? response.data : [];
    setAccounts(data);
    setError(null);
  } catch (err) {
    setError(err as Error);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchAccounts()
  }, [])

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts
  }
}