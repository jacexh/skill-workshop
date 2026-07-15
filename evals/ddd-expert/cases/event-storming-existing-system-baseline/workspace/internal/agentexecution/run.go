package agentexecution

// Run owns execution identity, fencing, and terminal execution outcome.
type Run struct {
	ID      string
	Fence   uint64
	Outcome string
}
