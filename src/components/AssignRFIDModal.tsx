import React, { useState, useEffect } from 'react';
import { X, User as UserIcon } from 'lucide-react';
import { iotService } from '@/services/iotService';

/**
 * Interface representing the persistent state stored in localStorage.
 */
export interface StorageAssignmentState {
  faculty_id: number;
  faculty_name: string;
  faculty_email: string;
  card_uid: string;
}

interface AssignRFIDModalProps {
  /** Indicates if the parent wants the modal open */
  isOpen: boolean;
  /** The ID of the faculty member being assigned */
  facultyId: number | null;
  /** The name of the faculty member */
  facultyName: string;
  /** The email of the faculty member */
  facultyEmail: string;
  /** The currently scanned/inputted card UID */
  scannedUid: string;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback executed when assignment is confirmed */
  onAssign: (facultyId: number, cardUid: string) => Promise<void>;
  /** Callback to restore parent state if an interrupted assignment is found on mount */
  onRestoreState?: (state: StorageAssignmentState) => void;
}

const STORAGE_KEY = 'rfid_assignment_draft_state';

export default function AssignRFIDModal({
  isOpen,
  facultyId,
  facultyName,
  facultyEmail,
  scannedUid,
  onClose,
  onAssign,
  onRestoreState
}: AssignRFIDModalProps) {
  // Local state for the input field to allow manual typing while syncing with scanned props
  const [cardUid, setCardUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Check LocalStorage on Initialization for State Restoration
  useEffect(() => {
    try {
      const savedStateStr = localStorage.getItem(STORAGE_KEY);
      if (savedStateStr) {
        const savedState: StorageAssignmentState = JSON.parse(savedStateStr);
        // If there's an uncommitted assignment, alert the parent to restore it and open the modal
        if (savedState.faculty_id && onRestoreState) {
          onRestoreState(savedState);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved RFID assignment state', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // 2. Sync incoming scanned props and mirror active state to LocalStorage
  useEffect(() => {
    if (isOpen && facultyId) {
      if (scannedUid) {
        setCardUid(scannedUid.toUpperCase());
      }
      const currentState: StorageAssignmentState = {
        faculty_id: facultyId,
        faculty_name: facultyName,
        faculty_email: facultyEmail,
        card_uid: cardUid || scannedUid
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    }
  }, [isOpen, facultyId, facultyName, facultyEmail, scannedUid, cardUid]);

  // 2.5. DIRECTLY LISTEN TO IOT SERVICE TO BYPASS PARENT
  useEffect(() => {
    if (!isOpen) return;

    const handleDirectScan = (event: any) => {
      console.log('[AssignRFIDModal] Direct scan intercepted:', event);
      const payload = event?.data || event;
      const uid = String(payload?.card_uid || payload?.cardUid || payload?.uid || payload?.card_id || "").toUpperCase();
      
      if (uid && uid !== "UNDEFINED") {
        setCardUid(uid);
      }
    };

    const unsub1 = iotService.subscribe('rfid_scan', handleDirectScan);
    const unsub2 = iotService.subscribe('rfid_scan_detected', handleDirectScan);
    const unsub3 = iotService.subscribe('scan_result', handleDirectScan);
    const unsubAll = iotService.subscribe('*', handleDirectScan);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsubAll();
    };
  }, [isOpen]);

  // 3. Clean Reset on Cancel / Close
  const handleCancel = () => {
    setCardUid('');
    localStorage.removeItem(STORAGE_KEY);
    onClose();
  };

  // 4. Handle Successful Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyId || !cardUid.trim()) return;

    try {
      setIsSubmitting(true);
      await onAssign(facultyId, cardUid.trim().toUpperCase());
      
      // On success, clean up local state and persistent storage
      setCardUid('');
      localStorage.removeItem(STORAGE_KEY);
      onClose();
    } catch (error) {
      console.error('Assignment failed', error);
      // Let the parent handle the error toast/modal; do NOT clear local storage here
      // so the user can try again without losing their data.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CreditCardIcon className="text-[#00dfa2] w-5 h-5" />
            <h3 className="text-gray-900 font-semibold text-base">Assign RFID Card</h3>
          </div>
          <button 
            type="button" 
            onClick={handleCancel} 
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* User Profile Block */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
              <UserIcon size={20} />
            </div>
            <div>
              <p className="text-gray-900 text-sm font-semibold">{facultyName || "Unknown User"}</p>
              <p className="text-gray-500 text-xs font-mono">{facultyEmail || "No email provided"}</p>
            </div>
          </div>

          {/* Card UID Input */}
          <div>
            <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 block font-semibold">
              Card UID *
            </label>
            <input
              required
              type="text"
              value={cardUid}
              onChange={(e) => setCardUid(e.target.value.toUpperCase())}
              placeholder="Scan a new or pre-registered RFID card..."
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00dfa2]/20 focus:border-[#00dfa2] transition-all"
            />
            <p className="text-gray-500 text-xs mt-2">
              Scan a new or pre-registered RFID card on the reader.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={handleCancel} 
              disabled={isSubmitting}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !cardUid.trim()}
              className="flex-1 bg-[#00dfa2] hover:bg-[#00c892] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#00dfa2]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Assign Card"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Simple icon for header
function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
