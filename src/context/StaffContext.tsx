import { createContext, useContext } from 'react';
import type { StaffMember } from '../data/initialData';

interface StaffContextType {
  allStaff: StaffMember[];
  setAllStaff: React.Dispatch<React.SetStateAction<StaffMember[]>>;
}

export const StaffContext = createContext<StaffContextType>({
  allStaff: [],
  setAllStaff: () => {},
});

export const useStaff = () => useContext(StaffContext);
