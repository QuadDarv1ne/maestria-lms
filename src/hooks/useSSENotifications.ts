"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { log } from "@/lib/logger";

export function useSSENotifications() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const addNotification = useAppStore((s) => s.addNotification);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const hasFetchedRef = useRef(false);

  // Keep refs always up-to-date so the SSE handler uses latest callbacks
  const addNotificationRef = useRef(addNotification);
  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => {
    addNotificationRef.current = addNotification;
    fetchNotificationsRef.current = fetchNotifications;
  }, [addNotification, fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    let retryDelay = 1000;

    // Fetch existing notifications from server on mount
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchNotificationsRef.current();
    }

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/notifications/sse");
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "notification") {
            addNotificationRef.current(data.notification);
          }
        } catch (err) {
          log.warn("SSE message parse error", { error: err });
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        reconnectTimerRef.current = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };

      es.onopen = () => {
        retryDelay = 1000;
      };
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [user]);
}
