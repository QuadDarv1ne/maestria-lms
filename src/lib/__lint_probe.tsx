"use client";

import { useEffect, useState, useCallback } from "react";

// Вариант A: прямой вызов async-функции (как в PaymentPageClient)
export function ProbeA({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  const fetchIt = useCallback(async () => {
    const res = await fetch(`/api/${id}`);
    const json = await res.json();
    setData(json);
  }, [id]);
  useEffect(() => {
    void fetchIt();
  }, [fetchIt]);
  return <div>{data}</div>;
}

// Вариант B: IIFE с await внутри эффекта
export function ProbeB({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/${id}`);
      const json = await res.json();
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  return <div>{data}</div>;
}

// Вариант C: .then()
export function ProbeC({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return <div>{data}</div>;
}

// Вариант D: синхронный setState в эффекте (эталон нарушения)
export function ProbeD() {
  const [x, setX] = useState(0);
  useEffect(() => {
    setX(1);
  }, []);
  return <div>{x}</div>;
}

// Вариант E: обёртка вызова в async IIFE (без await результата)
export function ProbeE({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  const fetchIt = useCallback(async () => {
    const res = await fetch(`/api/${id}`);
    setData(await res.json());
  }, [id]);
  useEffect(() => {
    void (async () => {
      await fetchIt();
    })();
  }, [fetchIt]);
  return <div>{data}</div>;
}

// Вариант F: вызов через .then()
export function ProbeF({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  const fetchIt = useCallback(async () => {
    const res = await fetch(`/api/${id}`);
    const json = await res.json();
    setData(json);
    return json;
  }, [id]);
  useEffect(() => {
    void fetchIt().then(() => {});
  }, [fetchIt]);
  return <div>{data}</div>;
}

// Вариант G: синхронный setLoading до await внутри общей функции
export function ProbeG({ id }: { id: string }) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchIt = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/${id}`);
    setData(await res.json());
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void (async () => {
      await fetchIt();
    })();
  }, [fetchIt]);
  return <div>{loading ? "..." : data}</div>;
}
