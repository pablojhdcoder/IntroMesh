interface NDEFRecordInit {
  recordType: string;
  data?: string;
}

interface NDEFMessage {
  records: Array<{ recordType: string; data?: BufferSource }>;
}

interface NDEFReadingEvent extends Event {
  message: NDEFMessage;
}

interface NDEFReader extends EventTarget {
  scan: () => Promise<void>;
  write: (message: string | { records: NDEFRecordInit[] }) => Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

interface Window {
  NDEFReader?: {
    new (): NDEFReader;
  };
}
