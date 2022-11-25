interface Course {
  id: string;
  title: string;
  attendeesIds: string[];
  city: string;
  date: string;
  literatur: Literatur;
}
interface Attendees {
  id: string;
  name: string;
  city: string;
  fees: Fee[];
}

interface Employee {
  id: string;
  name: string;
  salery: number;
  corseId: string[];
}

interface Fee {
  courseId: string;
  amount: number;
}

interface Literatur {
  price: number;
  amount: number;
  amountNeeded: number;
}
