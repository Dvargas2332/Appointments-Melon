export type UserKind = "client" | "business";
export type Importance = "low" | "medium" | "high";
export type ScheduleSource = "appointment" | "custom" | "device";
export type NotificationKind = "upcoming" | "status" | "reminder";

export type AuthUser = {
  id: string;
  email: string;
  kind: UserKind;
  role?: string | null;
};

export type Business = {
  id: string;
  name: string;
  category: string;
  timezone: string;
  phone?: string | null;
  country?: string | null;
  region?: string | null;
  owner?: { id: string; name?: string | null; avatarUrl?: string | null };
};

export type Service = { id: string; name: string; durationMin: number; priceYen: number };
export type Slot = { startAt: string; endAt: string };

export type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  business: Business;
  service: Service;
};

export type Activity = {
  id: string;
  title: string;
  note?: string;
  startAt: string;
  endAt?: string;
  kind: "manual" | "cita";
  importance?: Importance;
  businessName?: string;
  calendarEventId?: string;
};

export type AppNotification = {
  key: string;
  kind: NotificationKind;
  title: string;
  body: string;
  whenISO: string;
  createdAt: number;
  source?: ScheduleSource;
  itemId?: string;
};

export type DeviceLocationInfo = {
  latitude: number;
  longitude: number;
  country: string;
  region: string;
  city: string;
  timezone: string;
};

export type ScheduleItem = {
  source: ScheduleSource;
  id: string;
  title: string;
  subtitle: string;
  note?: string;
  startAt: string;
  endAt?: string;
  calendarEventId?: string;
  status: string;
  kind: "cita" | "manual";
  importance: Importance;
};
