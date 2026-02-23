<p align="center">
  <a href="https://homebridge.io"><img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>
<span align="center">

# Ciao

[![NPM-Version](https://badgen.net/npm/v/@homebridge/ciao)](https://www.npmjs.org/package/@homebridge/ciao)
[![NPM-Version Beta](https://badgen.net/npm/v/@homebridge/ciao/beta)](https://www.npmjs.org/package/@homebridge/ciao)
[![NPM-Downloads](https://badgen.net/npm/dt/@homebridge/ciao)](https://www.npmjs.org/package/@homebridge/ciao)
[![Node Build](https://github.com/homebridge/ciao/actions/workflows/build.yml/badge.svg)](https://github.com/homebridge/ciao/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/homebridge/ciao/badge.svg?branch=latest)](https://coveralls.io/github/homebridge/ciao?branch=latest)

</span>

`ciao` is a [RFC 6763](https://tools.ietf.org/html/rfc6763) compliant `dns-sd` library,
advertising on multicast dns ([RFC 6762](https://tools.ietf.org/html/rfc6762))
implemented in plain Typescript/JavaScript.

It is used in [HAP-NodeJS](https://github.com/homebridge/HAP-NodeJS) and is the successor of the 
[bonjour-hap](https://github.com/homebridge/bonjour) (and [bonjour](https://github.com/watson/bonjour)) library, 
aiming to be more robust, more maintainable and RFC compliant (read [Notice](https://github.com/homebridge/bonjour#notice)).

`ciao` features a multicast dns responder to publish service on the local network.
It will eventually gain browsing functionality in the future to also discover services on the local network
(There is currently no schedule when discover functionality will arrive. 
A possible querier implementation is limited as explained in [RFC 6762 15.1.](https://tools.ietf.org/html/rfc6762#section-15.1)
as it can't receive unicast responses).

`ciao` [passes](BCT-Results-CIAO-PI-en0.txt) the [Bonjour Conformance Test](https://developer.apple.com/bonjour/)
as defined and required by Apple.

The full documentation can be found [here](https://developers.homebridge.io/ciao/modules.html).

## Installation

Add `ciao` as a dependency to your project by running the following command:

```
npm install --save @homebridge/ciao
```

## Example

```ts
const ciao = require("@homebridge/ciao");

const responder = ciao.getResponder();

// create a service defining a web server running on port 3000
const service = responder.createService({
    name: 'My Web Server',
    type: 'http',
    port: 3000, // optional, can also be set via updatePort() before advertising
    txt: { // optional
      key: "value",
    }
})


service.advertise().then(() => {
  // stuff you do when the service is published
  console.log("Service is published :)");
});

// ....

service.updateTxt({ // replaces current txt
    newKey: "newValue",
});

// ....

service.end().then(() => {
  // service is now UNANNOUNCED and can be published again
});

// ....

// frees the service objects (and calls end() if still announced).
// The service object cannot be used again afterwards.
service.destroy();
```

## Documentation 

The full documentation can be found [here](https://developers.homebridge.io/ciao/modules.html).

### API overview

This section links to the most important aspects of the documentation as used in the example above.

First of all the [getResponder](https://developers.homebridge.io/ciao/functions/getResponder.html) function 
should be used to get a reference to a [Responder](https://developers.homebridge.io/ciao/classes/Responder.html) object.
The function takes some optional [options](https://developers.homebridge.io/ciao/interfaces/MDNSServerOptions.html)
to configure the underlying mdns server.

The [createService](https://developers.homebridge.io/ciao/classes/Responder.html#createService) method of the `Responder`
object can now be used to create a new [CiaoService](https://developers.homebridge.io/ciao/classes/CiaoService.html) 
supplying the desired [configuration](https://developers.homebridge.io/ciao/interfaces/ServiceOptions.html)
as the first parameter. You might have a look at the 
_[restrictedAddresses](https://developers.homebridge.io/ciao/interfaces/ServiceOptions.html#restrictedAddresses)_
(and _[disabledIpv6](https://developers.homebridge.io/ciao/interfaces/ServiceOptions.html#disabledIpv6)_) configuration
if you don't want to advertise on all available addresses/network interfaces.

The [advertise](https://developers.homebridge.io/ciao/classes/CiaoService.html#advertise) method can now be called
on the `service` object to start advertising the service on the network.
An application should ideally listen to the [NAME_CHANGED](https://developers.homebridge.io/ciao/enums/ServiceEvent.html#NAME_CHANGED)
event, in oder to persist any changes happening to the service name resulting of the conflict resolution algorithm.
The method [updateTxt](https://developers.homebridge.io/ciao/classes/CiaoService.html#updateTxt) can be used
to update the contest of the txt exposed by the service.

Any application SHOULD hook up a listener on events like SIGTERM or SIGINT and call the 
[shutdown](https://developers.homebridge.io/ciao/classes/Responder.html#shutdown) method of the responder object.
This will ensure, that goodbye packets are sent out on all connected network interfaces and all hosts
on the network get instantly notified of the shutdown.
Otherwise, stale data will remain in the caches of surrounding mdns browsers. 

### MTU

As of [RFC 6762 17. Multicast DNS Message Size](https://tools.ietf.org/html/rfc6762#section-17) DNS packets must avoid
IP Fragmentation and ensure that all sent packets are smaller than the Maximum Transmission Unit (MTU) defined by
the network interface. The MTU defaults to 1500 Bytes on pretty much all network cards for Ethernet and Wi-Fi.
`ciao` can't reliable detect modifications made to this default MTU size.
Thus , we rely on a hardcoded value, which is `1440` for the **UDP Payload Size** (Remember: the MTU defines the amount
of bytes Ethernet or Wi-Fi can transport on the local link. There is additional overhead caused by the IP Header 
and the UDP Header. So the amount of bytes we are able to fit into a single UDP packet is smaller).  
If you know, that the MTU differs on your machine, you can set the true **UDP Payload Size** in bytes
using the `CIAO_UPS` environment variable. 

### Notice on native mDNS responders

As described in [RFC 6762 15.](https://tools.ietf.org/html/rfc6762#section-15):
_"It is possible to have more than one Multicast DNS responder and/or
querier implementation coexist on the same machine, but there are some known issues."_

The RFC lists three possible issues:
 * [15.1.](https://tools.ietf.org/html/rfc6762#section-15.1) **Receiving Unicast Responses:**  
    As multiple sockets (from multiple responders) are bound to the port 5353, only one can receive unicast responses.
    Unicast responses is a way to reduce traffic on the multicast address, as answers to a particular question can be
    sent directly to the querier. As ciao does not hold the primary socket on port 5353, it can't receive unicast responses
    and thus must sent any queries without setting the QU (unicast response) flag. Any responses to our questions are 
    sent on multicast and thus increase the load on the network.  
    This currently isn't really a problem, as the only time we send queries is in the probing step before we 
    advertise a new service (Future query functionality is much more affected).
 * [15.2.](https://tools.ietf.org/html/rfc6762#section-15.2) **Multipacket Known-Answer lists:**  
    When the known-answer list of a query is too large to fit into a single dns packet, a querier can split those
    records into multiple packets (and setting the truncation flag).
    A responder will then reassemble those packets, which are identified by their originating ip address.  
    Thus, known-answer lists could be messed up when two queriers are sending at the same time.
    Again ciao currently only sends queries when probing, so the probability of this happening is pretty low. 
 * [15.3.](https://tools.ietf.org/html/rfc6762#section-15.3) **Efficiency:**  
    The last point is pretty simple. Two independently running responders use twice the memory and twice the computing power.
    It doesn't improve the situation that this is running using an interpreted language.  
    So yes, it's probably not very efficient. 
 
As the RFC also states in [15.4](https://tools.ietf.org/html/rfc6762#section-15.4), it is recommended to use 
a single mDNS implementation where possible. It is recommended to use the [mdns](https://www.npmjs.com/package/mdns)
library where possible, as the library is pretty much a binding for existing mDNS implementations running on your
system (like `mDNSResponder` on macOS or `avahi` on most linux based systems).  
The one downside with the `mdns` library is that running it on Windows is not really straight forward.
Generally we experienced with `homebridge` that many users run into problems when trying to install `mdns`.
Thus `bonjour-hap` and then `ciao` was created to provide a much easier to set up system.
