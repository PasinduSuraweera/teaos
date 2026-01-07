import {
  Leaf,
  Users,
  Scissors,
  Shield,
  Package,
  BarChart3,
  Thermometer,
  TrendingUp,
  Settings,
  FileText,
  User,
  Calendar,
  LayoutDashboard,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 2,
    label: "Plantation Management",
    items: [
      {
        title: "Plantations",
        url: "/dashboard/plantations",
        icon: Leaf,
      },
      {
        title: "Tea Sales",
        url: "/dashboard/tea-sales",
        icon: TrendingUp,
      },
      {
        title: "Factory Rates",
        url: "/dashboard/factory-rates",
        icon: BarChart3,
      },
    ],
  },
  {
    id: 3,
    label: "Employee Management",
    items: [
      {
        title: "Workers",
        url: "/dashboard/workers",
        icon: Users,
      },
      {
        title: "Daily Records",
        url: "/dashboard/daily-plucking",
        icon: Scissors,
      },
      {
        title: "Salary Management",
        url: "/dashboard/salary",
        icon: DollarSign,
      },
    ],
  },
  {
    id: 4,
    label: "Operations",
    items: [
      {
        title: "Scheduler",
        url: "/dashboard/scheduler",
        icon: Calendar,
      },
    ],
  },
  {
    id: 5,
    label: "Reports & Analytics",
    items: [
      {
        title: "PDF Reports",
        url: "/dashboard/reports",
        icon: FileText,
      }
    ],
  },
];
