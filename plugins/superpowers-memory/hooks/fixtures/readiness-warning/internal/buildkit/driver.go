package buildkit

// RealDriver is scaffolded for a future operational path.
type RealDriver struct{}

func (d *RealDriver) Solve() error {
	return errors.New("buildkit: RealDriver.Solve is not implemented")
}
