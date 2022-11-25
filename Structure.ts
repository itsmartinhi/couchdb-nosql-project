interface Course {
  id: string;
  title: string;
  // Array of Course Ids
  preconditions: string[];
  literatur: Literatur | null;
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

interface Fee {
  offerId: string;
  amount: number;
}

interface Literatur {
  price: number;
  amount: number;
  amountNeeded: number;
}

interface Offer {
  id: string;
  couseId: string;
  attendeeIds: string[];
  city: string;
  date: string;
}
