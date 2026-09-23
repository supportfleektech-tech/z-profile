import React from 'react';
import {
  LogIn, LayoutDashboard, Search, UserCheck, FileBarChart2, Briefcase,
  BarChart3, CreditCard, Shield, Server, Layers, Code2, UserCog, Bell,
  Smartphone, LayoutGrid, ArrowRight, ChevronRight, ChevronDown, Home,
  Share2, ExternalLink, Check, X, Sparkles, MoreHorizontal, Settings,
  TrendingUp, TrendingDown, Users, FileCheck2, RotateCcw, User, Phone,
  Mail, ShieldAlert, Loader2, Calendar, MapPin, Download, Printer, Plus,
  Edit2, Trash2, Power, Activity, RefreshCw, KeyRound, Database, Lock,
  ShieldCheck, CheckCircle2, Info, AlertCircle, AlertTriangle, Wallet,
  Landmark, ScrollText, Eye, EyeOff, Copy, Save, Filter, Ban, Key,
  Globe, Clock, Cpu, Gauge, CircleDollarSign, ArrowUpRight, ArrowDownLeft,
  FileText, Terminal, Link2, Zap, Building2, Scale, LifeBuoy, History,
  SlidersHorizontal, Radio, Fingerprint, MonitorSmartphone, Receipt, Coins,
} from 'lucide-react';

const ICON_SIZE = 16;

const icons = {
  LogIn, LayoutDashboard, Search, UserCheck, FileBarChart2, Briefcase,
  BarChart3, CreditCard, Shield, Server, Layers, Code2, UserCog, Bell,
  Smartphone, LayoutGrid, ArrowRight, ChevronRight, ChevronDown, Home,
  Share2, ExternalLink, Check, X, Sparkles, MoreHorizontal, Settings,
  TrendingUp, TrendingDown, Users, FileCheck2, RotateCcw, User, Phone,
  Mail, ShieldAlert, Loader2, Calendar, MapPin, Download, Printer, Plus,
  Edit2, Trash2, Power, Activity, RefreshCw, KeyRound, Database, Lock,
  ShieldCheck, CheckCircle2, Info, AlertCircle, AlertTriangle, Wallet,
  Landmark, ScrollText, Eye, EyeOff, Copy, Save, Filter, Ban, Key,
  Globe, Clock, Cpu, Gauge, CircleDollarSign, ArrowUpRight, ArrowDownLeft,
  FileText, Terminal, Link2, Zap, Building2, Scale, LifeBuoy, History,
  SlidersHorizontal, Radio, Fingerprint, MonitorSmartphone, Receipt, Coins,
} as const;

export const iconMap: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(icons).map(([name, Icon]) => [name, <Icon key={name} size={ICON_SIZE} />])
);

export const iconAt = (name: string, size = ICON_SIZE): React.ReactNode => {
  const Icon = (icons as Record<string, React.ComponentType<{ size?: number }>>)[name];
  return Icon ? <Icon size={size} /> : <LayoutGrid size={size} />;
};

export default iconMap;
