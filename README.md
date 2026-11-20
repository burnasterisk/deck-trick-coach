# Deck Trick Coach

"Create a sleek, dark-mode sports analytics web app called 'DeckCoach' for fingerboarding (Tech Deck) training. Make it fully responsive for both desktop browsers and mobile phones (using 100dvh so mobile Safari/Chrome toolbars don't cut off the bottom controls). On the main screen, render a live camera viewfinder using navigator.mediaDevices.getUserMedia with playsInline and muted attributes so iOS Safari works properly. Default to the rear camera (facingMode: 'environment') on mobile and standard webcam on desktop, with a 'Flip Camera' button in the top corner. Add a clean floating control bar at the bottom with a Trick Selector (Ollie, Kickflip, Heelflip, Pop Shuvit, Tre Flip), a 'Calibrate Surface' button, and a 'Stance Guide' toggle."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3917be72-59f3-5c27-b3a7-f88f8f301a13).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
