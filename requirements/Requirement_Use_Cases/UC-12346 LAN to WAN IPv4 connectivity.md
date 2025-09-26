# UC-12346 LAN to WAN IPv4 connectivity

## Goal

This use case verifies that a client on the LAN can connect to a server on the WAN using IPv4, ensuring basic outbound connectivity through the gateway.

## Scope

The system under test is the gateway device that routes traffic between the LAN and the WAN.

## Primary Actor

A user or an automated process on a LAN client device.

## Stakeholders

- **End-User:** Needs to access internet services from their LAN devices.
- **Network Administrator:** Responsible for ensuring the gateway provides basic internet connectivity.

## Level

User-goal.

## Preconditions

- The gateway is powered on and has completed its boot sequence.
- The gateway has an active WAN connection with a valid IPv4 address.
- A client device is connected to the gateway's LAN interface and has obtained an IPv4 address.
- A reachable HTTP server is active on the WAN side.

## Minimal Guarantees

- The gateway logs any connection failures.
- The LAN client's connection to the gateway is maintained.
- The gateway's existing connections are not adversely affected.

## Success Guarantees

- The LAN client successfully establishes a TCP connection to the WAN server.
- The gateway correctly performs Network Address Translation (NAT) for the outbound traffic.

## Trigger

A client on the LAN initiates an HTTP request to a server on the WAN using its IPv4 address.

## Main Success Scenario

1. An HTTP server is listening on a known port on the WAN.
2. The LAN client sends a TCP SYN packet destined for the WAN server's IPv4 address and port.
3. The gateway receives the packet, performs NAT, and forwards it to the WAN.
4. The WAN server responds with a SYN-ACK packet.
5. The gateway receives the SYN-ACK, translates the address back, and forwards it to the LAN client.
6. The LAN client completes the TCP handshake by sending an ACK packet, establishing the connection.
7. The LAN client can now send and receive HTTP traffic with the WAN server.

## Extensions

- **2a. WAN server is unreachable:**
  - The gateway attempts to forward the packet but receives no response.
  - The connection attempt from the LAN client times out.
- **2b. Gateway firewall blocks the connection:**
  - The gateway's firewall rules are configured to block the outbound traffic.
  - The gateway drops the packet, and the connection attempt from the LAN client fails.

## Technology & Data Variations List

- **Protocol:** The test uses HTTP over TCP, but the principle applies to other TCP-based protocols.
- **IP Version:** This use case is specific to IPv4. A separate use case is required for IPv6.

## Related information

- **Test Case:** `test_LAN_to_WAN_IPv4_connectivity` in `tests/gateway/test_connectivity_01.py`
- **Internal ID:** MVX_TST-533
