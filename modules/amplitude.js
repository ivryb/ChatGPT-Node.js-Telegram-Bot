import Amplitude from 'amplitude';

const { amplitudeApiKey } = process.env;

const pseudoAmp = {
  track: (params) => console.log('Amplitude', params)
}

export const amp = amplitudeApiKey ? new Amplitude(amplitudeApiKey) : pseudoAmp;