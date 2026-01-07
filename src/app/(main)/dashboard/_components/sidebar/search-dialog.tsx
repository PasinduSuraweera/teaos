"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

import { 
  LayoutDashboard, 
  Users, 
  Leaf, 
  TrendingUp,
  Search,
  MapPin,
  DollarSign,
  Scissors,
  BarChart3
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/lib/supabase";

interface SearchItem {
  group: string;
  icon?: React.ElementType;
  label: string;
  disabled?: boolean;
  href?: string;
  description?: string;
}

const staticItems: SearchItem[] = [
  { 
    group: "Overview", 
    icon: LayoutDashboard, 
    label: "Dashboard", 
    href: "/dashboard/default",
    description: "Main dashboard with estate metrics" 
  },
  { 
    group: "Plantation Management", 
    icon: Leaf, 
    label: "Plantations", 
    href: "/dashboard/plantations",
    description: "Manage plantation areas" 
  },
  { 
    group: "Plantation Management", 
    icon: TrendingUp, 
    label: "Tea Sales", 
    href: "/dashboard/tea-sales",
    description: "Track factory deliveries and sales" 
  },
  { 
    group: "Plantation Management", 
    icon: BarChart3, 
    label: "Factory Rates", 
    href: "/dashboard/factory-rates",
    description: "View current factory rates" 
  },
  { 
    group: "Employee Management", 
    icon: Users, 
    label: "Workers", 
    href: "/dashboard/workers",
    description: "Manage estate workers and staff" 
  },
  { 
    group: "Employee Management", 
    icon: Scissors, 
    label: "Daily Records", 
    href: "/dashboard/daily-plucking",
    description: "Record daily harvest data" 
  },
  { 
    group: "Employee Management", 
    icon: DollarSign, 
    label: "Salary Management", 
    href: "/dashboard/salary",
    description: "Manage worker salaries and bonuses" 
  },
];

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [searchItems, setSearchItems] = React.useState<SearchItem[]>(staticItems);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Fetch dynamic data when search opens
  React.useEffect(() => {
    if (open && !loading) {
      fetchDynamicData();
    }
  }, [open]);

  async function fetchDynamicData() {
    setLoading(true);
    try {
      const dynamicItems: SearchItem[] = [...staticItems];

      // Fetch workers
      const { data: workers } = await supabase
        .from('workers')
        .select('id, name, position')
        .limit(10);

      if (workers) {
        workers.forEach(worker => {
          dynamicItems.push({
            group: "Workers",
            icon: Users,
            label: worker.name,
            description: worker.position,
            href: `/dashboard/workers?id=${worker.id}`
          });
        });
      }

      // Fetch plantations
      const { data: plantations } = await supabase
        .from('plantations')
        .select('id, name, area_hectares')
        .limit(10);

      if (plantations) {
        plantations.forEach(plantation => {
          dynamicItems.push({
            group: "Plantations",
            icon: MapPin,
            label: plantation.name,
            description: `${plantation.area_hectares} hectares`,
            href: `/dashboard/plantations?id=${plantation.id}`
          });
        });
      }

      // Fetch recent plucking records
      const { data: pluckingRecords } = await supabase
        .from('daily_plucking')
        .select('id, date, kg_plucked, workers!inner(name)')
        .order('date', { ascending: false })
        .limit(5);

      if (pluckingRecords) {
        pluckingRecords.forEach(record => {
          const workerName = record.workers && Array.isArray(record.workers) 
            ? record.workers[0]?.name 
            : (record.workers as any)?.name;
          
          dynamicItems.push({
            group: "Recent Plucking",
            icon: Leaf,
            label: `${record.kg_plucked}kg on ${new Date(record.date).toLocaleDateString()}`,
            description: `Worker: ${workerName || 'Unknown'}`,
            href: `/dashboard/daily-plucking?date=${record.date}`
          });
        });
      }

      // Fetch recent tea sales
      const { data: teaSales } = await supabase
        .from('tea_sales')
        .select('id, sale_date, quantity_kg, total_amount')
        .order('sale_date', { ascending: false })
        .limit(5);

      if (teaSales) {
        teaSales.forEach(sale => {
          dynamicItems.push({
            group: "Recent Sales",
            icon: TrendingUp,
            label: `${sale.quantity_kg}kg - Rs. ${sale.total_amount?.toLocaleString() || 0}`,
            description: new Date(sale.sale_date).toLocaleDateString(),
            href: `/dashboard/tea-sales`
          });
        });
      }

      setSearchItems(dynamicItems);
    } catch (error) {
      console.error('Error fetching search data:', error);
      // Keep static items if dynamic fetch fails
      setSearchItems(staticItems);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (item: SearchItem) => {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <>
      <Button
        variant="link"
        className="text-muted-foreground !px-0 font-normal hover:no-underline"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Search
        <kbd className="bg-muted inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] font-medium select-none">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, workers, plantations..." />
        <CommandList>
          <CommandEmpty>
            {loading ? "Loading..." : "No results found."}
          </CommandEmpty>
          {[...new Set(searchItems.map((item) => item.group))].map((group, i) => (
            <React.Fragment key={group}>
              {i !== 0 && <CommandSeparator />}
              <CommandGroup heading={group} key={group}>
                {searchItems
                  .filter((item) => item.group === group)
                  .map((item, index) => (
                    <CommandItem 
                      className="!py-2" 
                      key={`${item.label}-${index}`} 
                      onSelect={() => handleSelect(item)}
                      disabled={item.disabled}
                    >
                      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
