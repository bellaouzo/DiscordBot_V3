export const state = {
  currentUser: null,
  mutualGuilds: [],
  selectedGuildId: null,
  isAdminMode: false,
  currentViewingTicketId: null,

  // Tickets
  loadedTickets: [],
  ticketFilter: 'all',
  ticketPage: 1,
  TICKET_PAGE_SIZE: 5,

  // Infractions
  loadedInfractions: [],
  infractionFilter: 'all',
  infractionPage: 1,
  INFRACTION_PAGE_SIZE: 5,

  // Profile Tickets
  loadedProfileTickets: [],
  profileTicketsPage: 1,
  PROFILE_TICKETS_PAGE_SIZE: 5
};
