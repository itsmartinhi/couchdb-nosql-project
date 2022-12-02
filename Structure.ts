interface Course {
  id: string;
  title: string;
  // Array of Course Ids
  preconditions: string[];
  literature: Literature | null;
}

interface Attendee {
  id: string;
  name: string;
  city: string;
  fees: Fee[];
}

interface Employee {
  id: string;
  name: string;
  salery: number;
  offerId: string[];
}
interface Offer {
  id: string;
  couseId: string;
  attendeeIds: string[];
  city: string;
  date: string;
}

interface Fee {
  offerId: string;
  amount: number;
}

interface Literature {
  price: number;
  amount: number;
  amountNeeded: number;
}


