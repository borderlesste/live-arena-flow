import { Providers } from "@/app/Providers";
import { AppRouter } from "@/app/AppRouter";
import { BrandProvider } from "@/components/brand/BrandProvider";

const App = () => (
  <Providers>
    <BrandProvider><AppRouter /></BrandProvider>
  </Providers>
);

export default App;
