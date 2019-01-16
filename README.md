Voice Controlled Radio Daemon (VCRD)
====================================

This Node.js app provides the core control daemon for the Voice Controlled
Radio (VCR).

VCR is a proof-of-concept prototype hardware device built by the European
Broadcast Union (EBU) and the National Association of Broadcasters (NAB) which
demonstrates how a voice assistant such as Amazon Alexa could be used to control
a broadcast radio receiver.

VCRD controls a seperate tuner daemon which allows manipulation of an FM/DAB
hardware tuner on the same device. Due to the licensing restrictions of the
manufacturer of the tuner chipset used in the hardware build this code cannot be
open sourced. The tuner daemon is called on startup to perform a "band" scan for
all available FM and/or DAB services receivable. Once complete, VCRD takes the
returned bearers and performs RadioDNS lookups against each one, in turn read
the attached Service Information (SI) if discovered. This ultimately builds up a
mapping of stream URL to broadcast bearer.

Once complete, VCRD launches Amazon's Alexa Voice Service (AVS) SDK compiled
with a customisation to output to STDOUT when it is requested to play an audio
URL. This typically occurs when a request to play a radio station is uttered and
accepted by the default TuneIn skill. In addition the AVS build is prevented
from attempting playback itself.

During standard operation the AVS app listens and responds to voice invocations.
When VCRD observes a streaming request, it performs a lookup on the internal
streaming URL to bearer map. If a match is found, VCRD issues a playback request
to the tuner for one or more broadcast bearers and monitors the tuner until
playback begins. In the event that all bearers fail, or no map match is found,
VCRD begins playing the original stream URL.

The wiki on this GitHub repo includes more information about the project and
full details of the hardware build.
