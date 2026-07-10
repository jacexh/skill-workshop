# Go references use Layer, Flow, and Platform Guides

Go House Style uses three orthogonal guide families. Layer Guides own stable Domain, Application, Transport, and Infrastructure placement and dependency contracts. Flow Guides own end-to-end CQRS, event/message, and taskqueue collaboration plus prescribed APIs and examples. Platform Guides own the multi-BC scaffold and runtime composition/lifecycle. The files remain physically flat under `references/`; `ddd-golang.md` groups and navigates them, while each normative rule has one owner to prevent cross-family duplication.

`ddd-golang.md` is also the Go House Style Baseline. It owns global dependency/import boundaries and the Mandatory Adopted Stack, naming one prescribed component per covered concern; the responsible leaf owns that component's applicability, verified API, and examples. This centralizes library choice without turning the router into a duplicate API manual.
